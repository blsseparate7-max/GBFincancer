
import { db } from "./firebaseConfig";
import { 
  collection, addDoc, doc, setDoc, deleteDoc, updateDoc, 
  serverTimestamp, increment, getDoc, arrayUnion 
} from "firebase/firestore";
import { FinanceEvent } from "../types";

export const dispatchEvent = async (uid: string, event: FinanceEvent) => {
  if (!uid) return { success: false, error: "No user ID" };

  try {
    const userRef = doc(db, "users", uid);
    const now = new Date();
    
    // Normalização de valores numéricos
    if (event.payload && event.payload.amount !== undefined) {
      event.payload.amount = Number(event.payload.amount);
    }

    switch (event.type) {
      case 'ADD_EXPENSE': {
        const { amount, category, description, paymentMethod, date } = event.payload;
        
        // Transação de saída (Cash/Pix)
        await addDoc(collection(userRef, "transactions"), {
          amount, category, description, paymentMethod: paymentMethod || 'PIX',
          type: 'EXPENSE',
          date: date || now.toISOString(),
          createdAt: serverTimestamp()
        });

        // Atualiza consumo de limite
        await updateLimitConsumption(uid, category, amount);
        break;
      }

      case 'ADD_INCOME': {
        await addDoc(collection(userRef, "transactions"), {
          ...event.payload,
          type: 'INCOME',
          createdAt: serverTimestamp()
        });
        break;
      }

      case 'ADD_CARD_CHARGE': {
        const { amount, category, description, cardId } = event.payload;
        
        // 1. Registra a transação como método CARD (O Dashboard irá ignorar no saldo livre)
        await addDoc(collection(userRef, "transactions"), {
          amount, category, description, paymentMethod: 'CARD',
          type: 'EXPENSE',
          cardId: cardId || 'default',
          date: now.toISOString(),
          createdAt: serverTimestamp()
        });

        // 2. Aumenta a dívida no documento do cartão
        const cardRef = doc(userRef, "cards", cardId || 'default');
        await setDoc(cardRef, {
          usedAmount: increment(amount),
          availableAmount: increment(-amount),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 3. Atualiza limite de categoria
        await updateLimitConsumption(uid, category, amount);
        break;
      }

      case 'PAY_CARD': {
        const { cardId, amount } = event.payload;
        
        // 1. Registra a saída real de dinheiro do Dashboard
        await addDoc(collection(userRef, "transactions"), {
          description: `Pagamento Fatura Cartão`,
          amount,
          category: 'Cartão de Crédito',
          type: 'EXPENSE',
          paymentMethod: 'PIX',
          date: now.toISOString(),
          createdAt: serverTimestamp()
        });

        // 2. Diminui a dívida do cartão
        const cardRef = doc(userRef, "cards", cardId);
        await updateDoc(cardRef, {
          usedAmount: increment(-amount),
          availableAmount: increment(amount),
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'UPDATE_LIMIT': {
        const { category, amount } = event.payload;
        const limitId = category.toLowerCase().trim().replace(/\s+/g, '_');
        await setDoc(doc(userRef, "limits", limitId), {
          category,
          limit: amount,
          spent: 0, // Reset ou incremento pode ser feito via job/listener
          isActive: true,
          updatedAt: serverTimestamp()
        }, { merge: true });
        break;
      }

      case 'CREATE_REMINDER': {
        const { description, amount, dueDay, category } = event.payload;
        const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay).toISOString();
        
        await addDoc(collection(userRef, "reminders"), {
          description, amount, dueDay, category: category || 'Contas',
          dueDate, isPaid: false, recurring: true,
          createdAt: serverTimestamp(), isActive: true
        });
        break;
      }

      case 'PAY_REMINDER': {
        const { billId, paymentMethod } = event.payload;
        const billRef = doc(userRef, "reminders", billId);
        const billSnap = await getDoc(billRef);
        
        if (billSnap.exists()) {
          const billData = billSnap.data();
          await updateDoc(billRef, { isPaid: true, paidAt: now.toISOString() });
          
          // Gera a transação de saída real no Dashboard
          await addDoc(collection(userRef, "transactions"), {
            description: `PGTO: ${billData.description}`,
            amount: billData.amount,
            category: billData.category,
            type: 'EXPENSE',
            paymentMethod: paymentMethod || 'PIX',
            date: now.toISOString(),
            createdAt: serverTimestamp()
          });
        }
        break;
      }

      case 'ADD_TO_GOAL': {
        const { goalId, amount, note } = event.payload;
        const goalRef = doc(userRef, "goals", goalId);
        await updateDoc(goalRef, {
          currentAmount: increment(amount),
          contributions: arrayUnion({
            id: Date.now().toString(),
            amount, note: note || "Aporte via Chat",
            date: now.toISOString()
          }),
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'CREATE_GOAL': {
        await addDoc(collection(userRef, "goals"), {
          ...event.payload,
          currentAmount: 0,
          createdAt: serverTimestamp()
        });
        break;
      }

      case 'DELETE_ITEM': {
        const { id, collection: colName } = event.payload;
        await deleteDoc(doc(userRef, colName, id));
        break;
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Event Dispatch Error:", error);
    return { success: false, error };
  }
};

async function updateLimitConsumption(uid: string, category: string, amount: number) {
  const limitId = category.toLowerCase().trim().replace(/\s+/g, '_');
  const limitRef = doc(db, "users", uid, "limits", limitId);
  const snap = await getDoc(limitRef);
  if (snap.exists()) {
    await updateDoc(limitRef, {
      spent: increment(amount),
      updatedAt: serverTimestamp()
    });
  }
}
