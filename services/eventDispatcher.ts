
import { db } from "./firebaseConfig";
import { 
  collection, addDoc, doc, setDoc, deleteDoc, updateDoc, 
  serverTimestamp, increment, getDoc, arrayUnion, getDocs, query, where 
} from "firebase/firestore";
import { FinanceEvent } from "../types";
import { normalizeCategoryName } from "./normalizationService";

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
        const normalizedCat = normalizeCategoryName(category);
        
        // Transação de saída (Cash/Pix)
        await addDoc(collection(userRef, "transactions"), {
          amount, category: normalizedCat, description, paymentMethod: paymentMethod || 'PIX',
          type: 'EXPENSE',
          date: date || now.toISOString(),
          createdAt: serverTimestamp()
        });

        // Atualiza consumo de limite
        await updateLimitConsumption(uid, normalizedCat, amount);
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
        const { amount, category, description, cardId, date } = event.payload;
        const normalizedCat = normalizeCategoryName(category);
        const chargeDate = date ? new Date(date) : now;
        
        // 1. Busca info do cartão para calcular o ciclo
        const cardRef = doc(userRef, "cards", cardId || 'default');
        const cardSnap = await getDoc(cardRef);
        let invoiceCycle = '';
        
        if (cardSnap.exists()) {
          const cardData = cardSnap.data();
          const closingDay = cardData.closingDay || 10;
          
          const d = new Date(chargeDate);
          if (d.getDate() > closingDay) {
            d.setMonth(d.getMonth() + 1);
          }
          invoiceCycle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        // 2. Registra a transação com o ciclo de fatura
        await addDoc(collection(userRef, "transactions"), {
          amount, category: normalizedCat, description, paymentMethod: 'CARD',
          type: 'EXPENSE',
          cardId: cardId || 'default',
          date: chargeDate.toISOString(),
          invoiceCycle,
          createdAt: serverTimestamp()
        });

        // 3. Aumenta a dívida no documento do cartão
        await updateDoc(cardRef, {
          usedAmount: increment(amount),
          availableAmount: increment(-amount),
          updatedAt: serverTimestamp()
        });

        // 4. Atualiza limite de categoria
        await updateLimitConsumption(uid, normalizedCat, amount);
        break;
      }

      case 'PAY_CARD': {
        const { cardId, amount, cycle } = event.payload;
        
        // 1. Registra a saída real de dinheiro do Dashboard
        await addDoc(collection(userRef, "transactions"), {
          description: `Pagamento Fatura ${cycle || ''}`,
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

        // 3. Marca as transações do ciclo como pagas (ou todas se não houver ciclo)
        const q = cycle 
          ? query(
              collection(userRef, "transactions"), 
              where("cardId", "==", cardId),
              where("invoiceCycle", "==", cycle),
              where("paymentMethod", "==", "CARD"),
              where("isPaid", "==", false)
            )
          : query(
              collection(userRef, "transactions"), 
              where("cardId", "==", cardId),
              where("paymentMethod", "==", "CARD"),
              where("isPaid", "==", false)
            );
        
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(doc(userRef, "transactions", d.id), { isPaid: true });
        }
        break;
      }

      case 'UPDATE_LIMIT': {
        const { category, amount } = event.payload;
        const normalizedCat = normalizeCategoryName(category);
        const limitId = normalizedCat.toLowerCase().trim().replace(/\s+/g, '_');
        await setDoc(doc(userRef, "limits", limitId), {
          category: normalizedCat,
          limit: amount,
          spent: 0, // Reset ou incremento pode ser feito via job/listener
          isActive: true,
          updatedAt: serverTimestamp()
        }, { merge: true });
        break;
      }

      case 'CREATE_REMINDER': {
        const { description, amount, dueDay, category, type, recurring } = event.payload;
        const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay).toISOString();
        
        await addDoc(collection(userRef, "reminders"), {
          description, amount, dueDay, category: category || (type === 'RECEIVE' ? 'Recebimento' : 'Contas'),
          dueDate, isPaid: false, recurring: recurring !== undefined ? recurring : true,
          type: type || 'PAY',
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
          const isReceive = billData.type === 'RECEIVE';
          
          await updateDoc(billRef, { isPaid: true, paidAt: now.toISOString() });
          
          // Gera a transação real no Dashboard
          await addDoc(collection(userRef, "transactions"), {
            description: isReceive ? `REC: ${billData.description}` : `PGTO: ${billData.description}`,
            amount: billData.amount,
            category: billData.category || (isReceive ? 'Recebimento' : 'Contas'),
            type: isReceive ? 'INCOME' : 'EXPENSE',
            paymentMethod: paymentMethod || 'PIX',
            date: billData.dueDate || now.toISOString(),
            createdAt: serverTimestamp()
          });

          // Se for recorrente, cria o do próximo mês
          if (billData.recurring) {
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, billData.dueDay);
            // Ajuste para meses com menos dias (ex: 31 de Jan -> 28/29 de Fev)
            if (nextMonth.getDate() !== billData.dueDay) {
              nextMonth.setDate(0);
            }
            
            await addDoc(collection(userRef, "reminders"), {
              description: billData.description,
              amount: billData.amount,
              dueDay: billData.dueDay,
              category: billData.category,
              type: billData.type || 'PAY',
              dueDate: nextMonth.toISOString(),
              isPaid: false,
              recurring: true,
              createdAt: serverTimestamp(),
              isActive: true
            });
          }
        }
        break;
      }

      case 'ADD_TO_GOAL': {
        let { goalId, amount, note, name } = event.payload;
        
        if (!goalId && name) {
          // Tenta encontrar por nome
          const { getDocs, query, where } = await import("firebase/firestore");
          const q = query(collection(userRef, "goals"), where("name", "==", name));
          const snap = await getDocs(q);
          if (!snap.empty) {
            goalId = snap.docs[0].id;
          }
        }

        if (!goalId) return { success: false, error: "Goal not found" };

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

      case 'UPDATE_GOAL': {
        const { goalId, ...updates } = event.payload;
        const goalRef = doc(userRef, "goals", goalId);
        await updateDoc(goalRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'DELETE_GOAL': {
        const { id } = event.payload;
        if (!id) throw new Error("ID is required for DELETE_GOAL");
        await deleteDoc(doc(userRef, "goals", id));
        break;
      }

      case 'SPEND_FROM_GOAL': {
        const { goalId, amount, description, category } = event.payload;
        if (!goalId || !amount) throw new Error("Goal ID and amount are required");

        const goalRef = doc(userRef, "goals", goalId);
        const goalSnap = await getDoc(goalRef);
        
        if (!goalSnap.exists()) throw new Error("Goal not found");
        const goalData = goalSnap.data();

        if (goalData.currentAmount < amount) {
          throw new Error("Saldo insuficiente na meta");
        }

        // 1. Decrementa saldo da meta e adiciona registro de saída
        await updateDoc(goalRef, {
          currentAmount: increment(-amount),
          contributions: arrayUnion({
            id: Date.now().toString(),
            amount: -amount,
            note: `Gasto: ${description || 'Sem descrição'}`,
            date: now.toISOString()
          }),
          updatedAt: serverTimestamp()
        });

        // 2. Cria transação real de despesa
        const normalizedCat = normalizeCategoryName(category || goalData.category || 'Lazer');
        await addDoc(collection(userRef, "transactions"), {
          description: `Gasto da meta: ${goalData.name}${description ? ` - ${description}` : ''}`,
          amount,
          category: normalizedCat,
          type: 'EXPENSE',
          paymentMethod: 'META', // Identificador especial para saber que veio de uma meta
          date: now.toISOString(),
          createdAt: serverTimestamp()
        });

        // 3. Atualiza limite de categoria
        await updateLimitConsumption(uid, normalizedCat, amount);
        break;
      }

      case 'ADD_CARD': {
        const { name, bank, limit, dueDay, closingDay } = event.payload;
        await addDoc(collection(userRef, "cards"), {
          name,
          bank: bank || '',
          limit: Number(limit),
          usedAmount: 0,
          availableAmount: Number(limit),
          dueDay: Number(dueDay),
          closingDay: closingDay ? Number(closingDay) : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'UPDATE_CARD': {
        const { id, limit, dueDay, closingDay } = event.payload;
        const cardRef = doc(userRef, "cards", id);
        const cardSnap = await getDoc(cardRef);
        
        if (cardSnap.exists()) {
          const cardData = cardSnap.data();
          const usedAmount = cardData.usedAmount || 0;
          const newLimit = Number(limit);
          
          await updateDoc(cardRef, {
            limit: newLimit,
            availableAmount: newLimit - usedAmount,
            dueDay: Number(dueDay),
            closingDay: closingDay ? Number(closingDay) : (cardData.closingDay || null),
            updatedAt: serverTimestamp()
          });
        }
        break;
      }

      case 'DELETE_CARD': {
        const { id } = event.payload;
        if (!id) throw new Error("ID is required for DELETE_CARD");
        await deleteDoc(doc(userRef, "cards", id));
        break;
      }

      case 'DELETE_REMINDER': {
        const { id } = event.payload;
        if (!id) throw new Error("ID is required for DELETE_REMINDER");
        await deleteDoc(doc(userRef, "reminders", id));
        break;
      }

      case 'UPDATE_TRANSACTION': {
        const { id, updates, oldData } = event.payload;
        const transRef = doc(userRef, "transactions", id);
        
        const finalUpdates = { ...updates };
        if (finalUpdates.category) {
          finalUpdates.category = normalizeCategoryName(finalUpdates.category);
        }

        await updateDoc(transRef, {
          ...finalUpdates,
          updatedAt: serverTimestamp()
        });

        // Se for despesa e mudou valor ou categoria, ajusta limites
        if (oldData && (oldData.type === 'EXPENSE' || finalUpdates.type === 'EXPENSE')) {
          const oldAmount = Number(oldData.amount || 0);
          const newAmount = finalUpdates.amount !== undefined ? Number(finalUpdates.amount) : oldAmount;
          const oldCat = normalizeCategoryName(oldData.category);
          const newCat = finalUpdates.category || oldCat;

          if (oldCat === newCat) {
            if (oldAmount !== newAmount) {
              await updateLimitConsumption(uid, oldCat, newAmount - oldAmount);
            }
          } else {
            // Categorias diferentes: remove do antigo, adiciona no novo
            await updateLimitConsumption(uid, oldCat, -oldAmount);
            await updateLimitConsumption(uid, newCat, newAmount);
          }
        }
        break;
      }

      case 'DELETE_ITEM': {
        const { id, collection: colName, oldData } = event.payload;
        if (!id || !colName) throw new Error("ID and collection are required for DELETE_ITEM");
        
        await deleteDoc(doc(userRef, colName, id));

        // Se deletou uma transação de despesa, estorna o limite
        if (colName === 'transactions' && oldData && oldData.type === 'EXPENSE') {
          const normalizedCat = normalizeCategoryName(oldData.category);
          await updateLimitConsumption(uid, normalizedCat, -Number(oldData.amount));
        }
        break;
      }

      case 'ADMIN_UPDATE_USER': {
        const { targetUid, updates, adminId } = event.payload;
        const targetRef = doc(db, "users", targetUid);
        await updateDoc(targetRef, {
          ...updates,
          localUpdatedAt: new Date().toISOString()
        });
        
        // Log de Auditoria
        await addDoc(collection(db, "admin", "auditLogs", "entries"), {
          adminId,
          action: 'UPDATE_USER',
          targetUserId: targetUid,
          details: `Atualizou campos: ${Object.keys(updates).join(', ')}`,
          createdAt: serverTimestamp()
        });
        break;
      }

      case 'ADMIN_DELETE_USER': {
        const { targetUid, adminId } = event.payload;
        await deleteDoc(doc(db, "users", targetUid));
        
        // Log de Auditoria
        await addDoc(collection(db, "admin", "auditLogs", "entries"), {
          adminId,
          action: 'DELETE_USER',
          targetUserId: targetUid,
          details: `Usuário excluído permanentemente`,
          createdAt: serverTimestamp()
        });
        break;
      }

      case 'ADMIN_SEND_BROADCAST': {
        const { title, body, targetUid, adminId } = event.payload;
        
        const sendToUser = async (uid: string) => {
          await addDoc(collection(db, "users", uid, "notifications"), {
            type: 'ADMIN_BROADCAST',
            title,
            body,
            createdAt: serverTimestamp()
          });
        };

        if (targetUid) {
          await sendToUser(targetUid);
        } else {
          // Global
          const usersSnap = await getDocs(collection(db, "users"));
          for (const userDoc of usersSnap.docs) {
            await sendToUser(userDoc.id);
          }
        }

        // Log de Auditoria
        await addDoc(collection(db, "admin", "auditLogs", "entries"), {
          adminId,
          action: 'SEND_BROADCAST',
          targetUserId: targetUid || 'GLOBAL',
          details: `Título: ${title}`,
          createdAt: serverTimestamp()
        });
        break;
      }

      case 'ADMIN_UPDATE_CONFIG': {
        const { config: newConfig, adminId } = event.payload;
        await setDoc(doc(db, "admin", "config"), {
          ...newConfig,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Log de Auditoria
        await addDoc(collection(db, "admin", "auditLogs", "entries"), {
          adminId,
          action: 'UPDATE_CONFIG',
          details: `Configurações globais atualizadas`,
          createdAt: serverTimestamp()
        });
        break;
      }

      case 'CREATE_WALLET': {
        await addDoc(collection(userRef, "wallets"), {
          ...event.payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'UPDATE_WALLET': {
        const { id, ...updates } = event.payload;
        await updateDoc(doc(userRef, "wallets", id), {
          ...updates,
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'DELETE_WALLET': {
        const { id } = event.payload;
        await deleteDoc(doc(userRef, "wallets", id));
        break;
      }

      case 'TRANSFER_WALLET': {
        const { fromWalletId, toWalletId, amount, note, date } = event.payload;
        
        // 1. Decrementa da origem
        await updateDoc(doc(userRef, "wallets", fromWalletId), {
          balance: increment(-amount),
          updatedAt: serverTimestamp()
        });

        // 2. Incrementa no destino
        await updateDoc(doc(userRef, "wallets", toWalletId), {
          balance: increment(amount),
          updatedAt: serverTimestamp()
        });

        // 3. Registra a transferência
        await addDoc(collection(userRef, "walletTransfers"), {
          fromWalletId, toWalletId, amount, note, date: date || new Date().toISOString(),
          createdAt: serverTimestamp()
        });
        break;
      }

      case 'CREATE_CATEGORY': {
        await addDoc(collection(userRef, "categories"), {
          ...event.payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'UPDATE_CATEGORY': {
        const { id, ...updates } = event.payload;
        await updateDoc(doc(userRef, "categories", id), {
          ...updates,
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'DELETE_CATEGORY': {
        const { id, name } = event.payload;
        await deleteDoc(doc(userRef, "categories", id));
        
        // Mover transações antigas para "Outros"
        const q = query(collection(userRef, "transactions"), where("category", "==", name));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(doc(userRef, "transactions", d.id), { category: "Outros" });
        }
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
