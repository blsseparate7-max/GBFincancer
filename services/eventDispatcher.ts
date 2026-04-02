
import { db } from "./firebaseConfig";
import { 
  collection, addDoc, doc, setDoc, deleteDoc, updateDoc, 
  serverTimestamp, increment, getDoc, arrayUnion, getDocs, query, where,
  writeBatch, limit
} from "firebase/firestore";
import { FinanceEvent, TransactionType } from "../types";
import { normalizeCategoryName } from "./normalizationService";

async function getWalletInfo(uid: string, walletId: string) {
  if (!walletId) return null;
  const walletRef = doc(db, "users", uid, "wallets", walletId);
  const snap = await getDoc(walletRef);
  if (snap.exists()) {
    return { id: snap.id, name: snap.data().name };
  }
  return null;
}

async function getCategoryInfo(uid: string, categoryName: string) {
  if (!categoryName) return { id: 'outros', name: 'Outros' };
  const normalized = normalizeCategoryName(categoryName);
  const q = query(collection(db, "users", uid, "categories"), where("name", "==", normalized), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, name: d.data().name };
  }
  return { id: 'outros', name: normalized };
}

export const migrateTransactions = async (uid: string) => {
  if (!uid) return 0;
  try {
    const userRef = doc(db, "users", uid);
    const transRef = collection(userRef, "transactions");
    const snap = await getDocs(transRef);
    
    const walletsSnap = await getDocs(collection(userRef, "wallets"));
    const walletsMap = new Map(walletsSnap.docs.map(d => [d.id, d.data().name]));
    
    const categoriesSnap = await getDocs(collection(userRef, "categories"));
    const categoriesMap = new Map(categoriesSnap.docs.map(d => [d.data().name, d.id]));

    const batch = writeBatch(db);
    let count = 0;

    for (const d of snap.docs) {
      const data = d.data();
      const updates: any = {};
      
      // 1. Wallet Info
      const walletId = data.walletId || data.sourceWalletId || data.targetWalletId;
      if (walletId && !data.walletName) {
        updates.walletId = walletId;
        updates.walletName = walletsMap.get(walletId) || null;
      }

      // 2. Category Info
      if (data.category && (!data.categoryId || !data.categoryName)) {
        const normalized = normalizeCategoryName(data.category);
        updates.category = normalized;
        updates.categoryName = normalized;
        updates.categoryId = categoriesMap.get(normalized) || 'outros';
      }

      // 3. Payment Method Consistency
      if (updates.walletName || data.walletName) {
        const wName = (updates.walletName || data.walletName || "").toLowerCase();
        if (wName.includes('dinheiro') && data.paymentMethod === 'PIX') {
          updates.paymentMethod = 'CASH';
        }
      }

      if (Object.keys(updates).length > 0) {
        batch.update(d.ref, updates);
        count++;
      }
      
      if (count >= 450) { // Firestore batch limit is 500
        await batch.commit();
        break; 
      }
    }
    
    if (count > 0 && count < 450) await batch.commit();
    console.log(`GB: Migração concluída. ${count} transações atualizadas.`);
    return count;
  } catch (error) {
    console.error("GB: Erro na migração:", error);
    return 0;
  }
};

const getCycleKey = (dateStr?: string) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const dispatchEvent = async (uid: string, event: FinanceEvent) => {
  if (!uid) return { success: false, error: "No user ID" };

  try {
    const userRef = doc(db, "users", uid);
    const now = new Date();
    const batch = writeBatch(db);
    
    // Normalização de valores numéricos
    if (event.payload && event.payload.amount !== undefined) {
      event.payload.amount = Number(event.payload.amount);
    }

    // Sanitiza o payload para evitar 'undefined' que quebra o Firestore (recursivo)
    const sanitizePayload = (p: any): any => {
      if (p === null || p === undefined) return null;
      if (typeof p !== 'object') return p;
      if (p instanceof Date) return p;
      if (Array.isArray(p)) return p.map(item => sanitizePayload(item));

      const sanitized: any = {};
      Object.keys(p).forEach(key => {
        const val = p[key];
        if (val === undefined) {
          sanitized[key] = null;
        } else if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
          sanitized[key] = sanitizePayload(val);
        } else {
          sanitized[key] = val;
        }
      });
      return sanitized;
    };

    const payload = sanitizePayload(event.payload);
    const isQA = payload.isQA || false;
    const source = event.source || 'ui';
    const cycleKey = getCycleKey(payload.date);
    const confirmedBy = payload.confirmedBy || null;
    
    switch (event.type) {
      case 'ADD_EXPENSE': {
        const { amount, category, description, paymentMethod, date, cardId, sourceWalletId } = payload;
        
        if (paymentMethod === 'CARD' || cardId) {
          return await dispatchEvent(uid, {
            ...event,
            type: 'ADD_CARD_CHARGE',
            payload: { ...payload, cardId: cardId || 'default', confirmedBy }
          });
        }

        const catInfo = await getCategoryInfo(uid, category);
        const walletInfo = await getWalletInfo(uid, sourceWalletId);
        
        const transRef = doc(collection(userRef, "transactions"));
        
        // Determinar paymentMethod se não fornecido
        let finalPaymentMethod = paymentMethod;
        if (!finalPaymentMethod && walletInfo) {
          if (walletInfo.name.toLowerCase().includes('dinheiro')) {
            finalPaymentMethod = 'CASH';
          }
        }

        batch.set(transRef, {
          amount, 
          category: catInfo.name,
          categoryId: catInfo.id,
          categoryName: catInfo.name,
          description, 
          paymentMethod: finalPaymentMethod || null,
          type: 'EXPENSE',
          date: date || now.toISOString(),
          walletId: walletInfo?.id || null,
          walletName: walletInfo?.name || null,
          sourceWalletId: sourceWalletId || null,
          isQA,
          source,
          cycleKey,
          confirmedBy,
          status: 'CONFIRMED',
          resolved: true,
          createdAt: serverTimestamp()
        });

        if (sourceWalletId) {
          const walletRef = doc(userRef, "wallets", sourceWalletId);
          batch.update(walletRef, { 
            balance: increment(-amount),
            updatedAt: serverTimestamp()
          });
        }

        const limitId = (catInfo.name || "").toLowerCase().trim().replace(/\s+/g, '_');
        const limitRef = doc(userRef, "limits", limitId);
        batch.set(limitRef, {
          spent: increment(amount),
          updatedAt: serverTimestamp()
        }, { merge: true });

        await batch.commit();
        break;
      }

      case 'ADD_INCOME': {
        const { amount, targetWalletId, description, category, date, paymentMethod } = payload;
        const catInfo = await getCategoryInfo(uid, category || 'Recebimento');
        const walletInfo = await getWalletInfo(uid, targetWalletId);
        
        const transRef = doc(collection(userRef, "transactions"));
        
        batch.set(transRef, {
          ...payload,
          type: 'INCOME',
          category: catInfo.name,
          categoryId: catInfo.id,
          categoryName: catInfo.name,
          walletId: walletInfo?.id || null,
          walletName: walletInfo?.name || null,
          paymentMethod: paymentMethod || null,
          isQA,
          source,
          cycleKey,
          confirmedBy,
          status: 'CONFIRMED',
          resolved: true,
          createdAt: serverTimestamp()
        });

        if (targetWalletId) {
          const walletRef = doc(userRef, "wallets", targetWalletId);
          batch.update(walletRef, { 
            balance: increment(amount),
            updatedAt: serverTimestamp()
          });
        }

        await batch.commit();
        break;
      }

      case 'ADD_CARD_CHARGE': {
        let { amount, category, description, cardId, date, sourceWalletId, installments } = payload;
        const catInfo = await getCategoryInfo(uid, category);
        const chargeDate = date ? new Date(date) : now;
        const numInstallments = installments || 1;
        const installmentAmount = amount / numInstallments;
        
        let cardRef = doc(userRef, "cards", cardId || 'default');
        let cardSnap = await getDoc(cardRef);
        
        if (!cardSnap.exists()) {
          const cardsSnap = await getDocs(collection(userRef, "cards"));
          if (!cardsSnap.empty) {
            cardSnap = cardsSnap.docs[0];
            cardId = cardSnap.id;
            cardRef = doc(userRef, "cards", cardId);
          }
        }

        if (cardSnap.exists()) {
          const cardData = cardSnap.data();
          const closingDay = cardData.closingDay || 10;
          const cardName = cardData.name || 'Cartão';

          for (let i = 0; i < numInstallments; i++) {
            const currentInstallmentDate = new Date(chargeDate);
            currentInstallmentDate.setMonth(chargeDate.getMonth() + i);
            
            const d = new Date(currentInstallmentDate);
            if (d.getDate() > closingDay) {
              d.setMonth(d.getMonth() + 1);
            }
            const invoiceCycle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            const installmentDesc = numInstallments > 1 
              ? `${description} (${i + 1}/${numInstallments})`
              : description;

            const transRef = doc(collection(userRef, "transactions"));
            batch.set(transRef, {
              amount: installmentAmount, 
              category: catInfo.name,
              categoryId: catInfo.id,
              categoryName: catInfo.name,
              description: installmentDesc, 
              paymentMethod: 'CARD',
              type: 'EXPENSE',
              cardId: cardId || 'default',
              walletId: cardId || 'default',
              walletName: cardName,
              sourceWalletId: sourceWalletId || null,
              date: currentInstallmentDate.toISOString(),
              invoiceCycle,
              isPaid: false,
              isQA,
              source,
              cycleKey: invoiceCycle,
              confirmedBy,
              status: 'CONFIRMED',
              resolved: true,
              createdAt: serverTimestamp(),
              installmentNumber: i + 1,
              totalInstallments: numInstallments,
              originalAmount: amount
            });
          }

          batch.update(cardRef, {
            usedLimit: increment(amount),
            availableLimit: increment(-amount),
            currentInvoiceAmount: increment(numInstallments > 1 ? installmentAmount : amount),
            usedAmount: increment(amount),
            availableAmount: increment(-amount),
            invoiceAmount: increment(numInstallments > 1 ? installmentAmount : amount),
            updatedAt: serverTimestamp()
          });

          const limitId = (catInfo.name || "").toLowerCase().trim().replace(/\s+/g, '_');
          const limitRef = doc(userRef, "limits", limitId);
          batch.set(limitRef, {
            spent: increment(amount),
            updatedAt: serverTimestamp()
          }, { merge: true });

          await batch.commit();
        }
        break;
      }

      case 'PAY_CARD': {
        const { cardId, amount, cycle, sourceWalletId } = event.payload;
        
        // 1. Registra a saída real de dinheiro do Dashboard
        await addDoc(collection(userRef, "transactions"), {
          description: `Pagamento Fatura ${cycle || ''}`,
          amount,
          category: 'Cartão de Crédito',
          type: 'EXPENSE',
          paymentMethod: 'PIX',
          sourceWalletId: sourceWalletId || null,
          date: now.toISOString(),
          isQA,
          source,
          cycleKey,
          confirmedBy,
          status: 'CONFIRMED',
          resolved: true,
          createdAt: serverTimestamp()
        });

        // Atualiza saldo da carteira se houver
        if (sourceWalletId) {
          await updateWalletBalance(uid, sourceWalletId, -amount);
        }

        // 2. Atualiza o cartão (Regra da Vida Real)
        const cardRef = doc(userRef, "cards", cardId);
        await updateDoc(cardRef, {
          usedLimit: increment(-amount),
          availableLimit: increment(amount),
          currentInvoiceAmount: increment(-amount),
          // Compatibilidade
          usedAmount: increment(-amount),
          availableAmount: increment(amount),
          invoiceAmount: increment(-amount),
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
        const limitId = (normalizedCat || "").toLowerCase().trim().replace(/\s+/g, '_');
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
        const { description, amount, dueDay, category, type, recurring, targetWalletName } = event.payload;
        const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay).toISOString();
        
        await addDoc(collection(userRef, "reminders"), {
          description, amount, dueDay, category: category || (type === 'RECEIVE' ? 'Recebimento' : 'Contas'),
          dueDate, isPaid: false, recurring: recurring !== undefined ? recurring : true,
          type: type || 'PAY',
          targetWalletName: targetWalletName || null,
          isQA,
          source,
          cycleKey,
          confirmedBy,
          status: 'PENDING',
          resolved: false,
          createdAt: serverTimestamp(), isActive: true
        });
        break;
      }

      case 'PAY_REMINDER': {
        const { billId, paymentMethod, sourceWalletId, cardId } = payload;
        const billRef = doc(userRef, "reminders", billId);
        const billSnap = await getDoc(billRef);
        
        if (billSnap.exists()) {
          const billData = billSnap.data();
          const isReceive = billData.type === 'RECEIVE';
          const cycleKey = getCycleKey();
          
          batch.update(billRef, { 
            isPaid: true, 
            paidAt: now.toISOString(),
            status: isReceive ? 'RECEIVED' : 'PAID',
            resolved: true,
            lastPromptedAt: serverTimestamp(),
            cycleKey
          });
          
          if (paymentMethod === 'CARD' && !isReceive) {
            // Para cartão, o ADD_CARD_CHARGE já faz o commit do batch dele
            // Então precisamos commitar este primeiro
            await batch.commit();
            await dispatchEvent(uid, {
              type: 'ADD_CARD_CHARGE',
              payload: {
                amount: billData.amount,
                category: billData.category || 'Contas',
                description: `PGTO: ${billData.description}`,
                cardId: cardId || 'default',
                date: now.toISOString(),
                confirmedBy
              },
              source,
              createdAt: serverTimestamp()
            });
          } else {
            const transRef = doc(collection(userRef, "transactions"));
            batch.set(transRef, {
              description: isReceive ? `REC: ${billData.description}` : `PGTO: ${billData.description}`,
              amount: billData.amount,
              category: billData.category || (isReceive ? 'Recebimento' : 'Contas'),
              type: isReceive ? 'INCOME' : 'EXPENSE',
              paymentMethod: paymentMethod || 'PIX',
              sourceWalletId: sourceWalletId || null,
              date: billData.dueDate || now.toISOString(),
              isQA,
              source,
              cycleKey,
              confirmedBy,
              status: 'CONFIRMED',
              resolved: true,
              createdAt: serverTimestamp()
            });

            if (sourceWalletId) {
              const walletRef = doc(userRef, "wallets", sourceWalletId);
              batch.update(walletRef, { 
                balance: increment(isReceive ? billData.amount : -billData.amount),
                updatedAt: serverTimestamp()
              });
            }

            if (!isReceive) {
              const normalizedCat = normalizeCategoryName(billData.category || 'Contas');
              const limitId = (normalizedCat || "").toLowerCase().trim().replace(/\s+/g, '_');
              const limitRef = doc(userRef, "limits", limitId);
              batch.set(limitRef, {
                spent: increment(billData.amount),
                updatedAt: serverTimestamp()
              }, { merge: true });
            }

            // Se for recorrente, cria o do próximo mês
            if (billData.recurring) {
              const currentDueDate = billData.dueDate ? new Date(billData.dueDate) : new Date();
              const nextMonth = new Date(currentDueDate.getFullYear(), currentDueDate.getMonth() + 1, billData.dueDay);
              if (nextMonth.getDate() !== billData.dueDay) nextMonth.setDate(0);
              
              const nextBillRef = doc(collection(userRef, "reminders"));
              batch.set(nextBillRef, {
                description: billData.description,
                amount: billData.amount,
                dueDay: billData.dueDay,
                category: billData.category,
                type: billData.type || 'PAY',
                dueDate: nextMonth.toISOString(),
                isPaid: false,
                recurring: true,
                isQA,
                createdAt: serverTimestamp(),
                isActive: true,
                status: 'pending',
                resolved: false
              });
            }

            await batch.commit();
          }
        }
        break;
      }

      case 'ADD_TO_GOAL': {
        let { goalId, amount, note, name, sourceWalletId } = event.payload;
        
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
            date: now.toISOString(),
            sourceWalletId: sourceWalletId || null
          }),
          updatedAt: serverTimestamp()
        });

        // Atualiza saldo da carteira se houver
        if (sourceWalletId) {
          await updateWalletBalance(uid, sourceWalletId, -amount);
        }
        break;
      }

      case 'CREATE_GOAL': {
        await addDoc(collection(userRef, "goals"), {
          ...event.payload,
          currentAmount: event.payload.currentAmount !== undefined ? event.payload.currentAmount : 0,
          isQA,
          source,
          status: 'ACTIVE',
          resolved: false,
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
        const { goalId } = event.payload;
        if (!goalId) throw new Error("Goal ID is required for DELETE_GOAL");
        await deleteDoc(doc(userRef, "goals", goalId));
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
          isQA,
          createdAt: serverTimestamp()
        });

        // 3. Atualiza limite de categoria
        await updateLimitConsumption(uid, normalizedCat, amount);
        break;
      }

      case 'ADD_CARD': {
        const { name, bank, limit, dueDay, closingDay } = event.payload;
        const limitVal = Number(limit);
        await addDoc(collection(userRef, "cards"), {
          name,
          bank: bank || '',
          limitTotal: limitVal,
          usedLimit: 0,
          availableLimit: limitVal,
          currentInvoiceAmount: 0,
          // Compatibilidade
          limit: limitVal,
          usedAmount: 0,
          availableAmount: limitVal,
          invoiceAmount: 0,
          dueDay: Number(dueDay),
          closingDay: closingDay ? Number(closingDay) : null,
          isQA,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'UPDATE_CARD': {
        const { id, name, limit, dueDay, closingDay } = event.payload;
        const cardRef = doc(userRef, "cards", id);
        const cardSnap = await getDoc(cardRef);
        
        if (cardSnap.exists()) {
          const cardData = cardSnap.data();
          const usedLimit = cardData.usedLimit || cardData.usedAmount || 0;
          const newLimit = Number(limit);
          
          await updateDoc(cardRef, {
            name: name || cardData.name,
            limitTotal: newLimit,
            availableLimit: newLimit - usedLimit,
            // Compatibilidade
            limit: newLimit,
            availableAmount: newLimit - usedLimit,
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
        const { id, updates, oldData } = payload;
        const transRef = doc(userRef, "transactions", id);
        
        const finalUpdates = { ...(updates || {}) };
        
        // 1. Category Info Sync
        if (finalUpdates.category) {
          const catInfo = await getCategoryInfo(uid, finalUpdates.category);
          finalUpdates.category = catInfo.name;
          finalUpdates.categoryId = catInfo.id;
          finalUpdates.categoryName = catInfo.name;
        }

        // 2. Wallet Info Sync
        const newWalletId = finalUpdates.sourceWalletId || finalUpdates.targetWalletId;
        if (newWalletId) {
          const walletInfo = await getWalletInfo(uid, newWalletId);
          finalUpdates.walletId = walletInfo?.id || null;
          finalUpdates.walletName = walletInfo?.name || null;
        }

        await updateDoc(transRef, {
          ...finalUpdates,
          updatedAt: serverTimestamp()
        });

        // 3. Sincronização de Carteiras (Wallet Balance Sync)
        if (oldData) {
          const oldAmount = Number(oldData.amount || 0);
          const newAmount = finalUpdates.amount !== undefined ? Number(finalUpdates.amount) : oldAmount;
          const oldType = oldData.type;
          const newType = finalUpdates.type || oldType;
          const oldMethod = oldData.paymentMethod;
          const newMethod = finalUpdates.paymentMethod || oldMethod;
          const oldSourceWalletId = oldData.sourceWalletId;
          const newSourceWalletId = finalUpdates.sourceWalletId !== undefined ? finalUpdates.sourceWalletId : oldSourceWalletId;
          const oldTargetWalletId = oldData.targetWalletId;
          const newTargetWalletId = finalUpdates.targetWalletId !== undefined ? finalUpdates.targetWalletId : oldTargetWalletId;

          // Reverter impacto antigo
          if (oldType === 'INCOME' && oldTargetWalletId) {
            await updateWalletBalance(uid, oldTargetWalletId, -oldAmount);
          } else if (oldType === 'EXPENSE' && oldSourceWalletId && oldMethod !== 'CARD') {
            await updateWalletBalance(uid, oldSourceWalletId, oldAmount);
          }

          // Aplicar novo impacto
          if (newType === 'INCOME' && newTargetWalletId) {
            await updateWalletBalance(uid, newTargetWalletId, newAmount);
          } else if (newType === 'EXPENSE' && newSourceWalletId && newMethod !== 'CARD') {
            await updateWalletBalance(uid, newSourceWalletId, -newAmount);
          }
        }

        // 2. Sincronização de Limites e Cartões
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

          // Ajuste de Cartão de Crédito
          const oldCardId = oldData?.cardId;
          const newCardId = finalUpdates.cardId || oldCardId;
          const oldMethod = oldData?.paymentMethod;
          const newMethod = finalUpdates.paymentMethod || oldMethod;

          if (oldMethod === 'CARD' && newMethod === 'CARD') {
            if (oldCardId === newCardId) {
              if (oldAmount !== newAmount) {
                const cardRef = doc(userRef, "cards", oldCardId);
                const diff = newAmount - oldAmount;
                await updateDoc(cardRef, {
                  usedLimit: increment(diff),
                  availableLimit: increment(-diff),
                  currentInvoiceAmount: increment(diff),
                  // Compatibilidade
                  usedAmount: increment(diff),
                  availableAmount: increment(-diff),
                  invoiceAmount: increment(diff),
                  updatedAt: serverTimestamp()
                });
              }
            } else {
              // Mudou de cartão: estorna do antigo, cobra no novo
              if (oldCardId) {
                const oldCardRef = doc(userRef, "cards", oldCardId);
                await updateDoc(oldCardRef, {
                  usedLimit: increment(-oldAmount),
                  availableLimit: increment(oldAmount),
                  currentInvoiceAmount: increment(-oldAmount),
                  // Compatibilidade
                  usedAmount: increment(-oldAmount),
                  availableAmount: increment(oldAmount),
                  invoiceAmount: increment(-oldAmount),
                  updatedAt: serverTimestamp()
                });
              }
              if (newCardId) {
                const newCardRef = doc(userRef, "cards", newCardId);
                await updateDoc(newCardRef, {
                  usedLimit: increment(newAmount),
                  availableLimit: increment(-newAmount),
                  currentInvoiceAmount: increment(newAmount),
                  // Compatibilidade
                  usedAmount: increment(newAmount),
                  availableAmount: increment(-newAmount),
                  invoiceAmount: increment(newAmount),
                  updatedAt: serverTimestamp()
                });
              }
            }
          } else if (oldMethod !== 'CARD' && newMethod === 'CARD') {
            // Mudou para cartão: cobra no novo
            if (newCardId) {
              const newCardRef = doc(userRef, "cards", newCardId);
              await updateDoc(newCardRef, {
                usedLimit: increment(newAmount),
                availableLimit: increment(-newAmount),
                currentInvoiceAmount: increment(newAmount),
                // Compatibilidade
                usedAmount: increment(newAmount),
                availableAmount: increment(-newAmount),
                invoiceAmount: increment(newAmount),
                updatedAt: serverTimestamp()
              });
            }
          } else if (oldMethod === 'CARD' && newMethod !== 'CARD') {
            // Mudou de cartão para outro método: estorna do antigo
            if (oldCardId) {
              const oldCardRef = doc(userRef, "cards", oldCardId);
              await updateDoc(oldCardRef, {
                usedLimit: increment(-oldAmount),
                availableLimit: increment(oldAmount),
                currentInvoiceAmount: increment(-oldAmount),
                // Compatibilidade
                usedAmount: increment(-oldAmount),
                availableAmount: increment(oldAmount),
                invoiceAmount: increment(-oldAmount),
                updatedAt: serverTimestamp()
              });
            }
          }
        }
        break;
      }

      case 'DELETE_ITEM': {
        const { id, collection: colName } = event.payload;
        let { oldData } = event.payload;
        if (!id || !colName) throw new Error("ID and collection are required for DELETE_ITEM");
        
        const itemRef = doc(userRef, colName, id);
        
        // Se não temos oldData, buscamos antes de deletar para poder estornar limites/cartões
        if (!oldData) {
          const snap = await getDoc(itemRef);
          if (snap.exists()) {
            oldData = snap.data();
          }
        }

        await deleteDoc(itemRef);

        // Se deletou uma transação, estorna o impacto (Limite, Cartão e Carteira)
        if (colName === 'transactions' && oldData) {
          const amount = Number(oldData.amount || 0);
          
          // 1. Estorno de Limite de Categoria
          if (oldData.type === 'EXPENSE') {
            const normalizedCat = normalizeCategoryName(oldData.category);
            await updateLimitConsumption(uid, normalizedCat, -amount);
          }

          // 2. Estorno de Cartão de Crédito
          if (oldData.type === 'EXPENSE' && oldData.paymentMethod === 'CARD' && oldData.cardId) {
            const cardRef = doc(userRef, "cards", oldData.cardId);
            await updateDoc(cardRef, {
              usedLimit: increment(-amount),
              availableLimit: increment(amount),
              currentInvoiceAmount: increment(-amount),
              // Compatibilidade
              usedAmount: increment(-amount),
              availableAmount: increment(amount),
              invoiceAmount: increment(-amount),
              updatedAt: serverTimestamp()
            });
          }

          // 3. Estorno de Carteira (Wallet)
          if (oldData.type === 'INCOME' && oldData.targetWalletId) {
            await updateWalletBalance(uid, oldData.targetWalletId, -amount);
          } else if (oldData.type === 'EXPENSE' && oldData.sourceWalletId && oldData.paymentMethod !== 'CARD') {
            await updateWalletBalance(uid, oldData.sourceWalletId, amount);
          }
        }
        break;
      }

      case 'ADMIN_UPDATE_USER': {
        const { targetUid, updates, adminId } = payload;
        const targetRef = doc(db, "users", targetUid);
        const safeUpdates = updates || {};
        await updateDoc(targetRef, {
          ...safeUpdates,
          localUpdatedAt: new Date().toISOString()
        });
        
        // Log de Auditoria
        await addDoc(collection(db, "admin", "auditLogs", "entries"), {
          adminId,
          action: 'UPDATE_USER',
          targetUserId: targetUid,
          details: `Atualizou campos: ${Object.keys(safeUpdates).join(', ')}`,
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
          isActive: true,
          isQA,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'UPDATE_USER': {
        await updateDoc(userRef, {
          ...event.payload,
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
        await updateDoc(doc(userRef, "wallets", id), {
          isActive: false,
          updatedAt: serverTimestamp()
        });
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
          isQA,
          createdAt: serverTimestamp()
        });
        break;
      }

      case 'CREATE_CATEGORY': {
        await addDoc(collection(userRef, "categories"), {
          ...event.payload,
          isQA,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'UPDATE_CATEGORY': {
        const { id, name: newName, oldName } = event.payload;
        await updateDoc(doc(userRef, "categories", id), {
          name: newName,
          updatedAt: serverTimestamp()
        });

        // Se mudou o nome, atualiza as transações vinculadas e o limite
        if (oldName && oldName !== newName) {
          // 1. Atualiza transações
          const q = query(collection(userRef, "transactions"), where("category", "==", oldName));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            await updateDoc(doc(userRef, "transactions", d.id), { category: newName });
          }

          // 2. Migra limite se existir
          const oldLimitId = (oldName || "").toLowerCase().trim().replace(/\s+/g, '_');
          const newLimitId = (newName || "").toLowerCase().trim().replace(/\s+/g, '_');
          const oldLimitRef = doc(userRef, "limits", oldLimitId);
          const oldLimitSnap = await getDoc(oldLimitRef);
          
          if (oldLimitSnap.exists()) {
            const limitData = oldLimitSnap.data();
            await setDoc(doc(userRef, "limits", newLimitId), {
              ...limitData,
              category: newName,
              updatedAt: serverTimestamp()
            });
            await deleteDoc(oldLimitRef);
          }
        }
        break;
      }

      case 'MOVE_TRANSACTION_CATEGORY': {
        const { transactionId, newCategory } = event.payload;
        const transRef = doc(userRef, "transactions", transactionId);
        const transSnap = await getDoc(transRef);
        
        if (transSnap.exists()) {
          const oldData = transSnap.data();
          const oldCat = oldData.category;
          const amount = oldData.amount;
          
          await updateDoc(transRef, {
            category: newCategory,
            updatedAt: serverTimestamp()
          });

          // Ajusta limites
          if (oldData.type === 'EXPENSE') {
            await updateLimitConsumption(uid, oldCat, -amount);
            await updateLimitConsumption(uid, newCategory, amount);
          }
        }
        break;
      }

      case 'DELETE_CATEGORY': {
        const { id, name } = event.payload;
        await deleteDoc(doc(userRef, "categories", id));
        
        // 1. Mover transações antigas para "Outros"
        const q = query(collection(userRef, "transactions"), where("category", "==", name));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(doc(userRef, "transactions", d.id), { category: "Outros" });
        }

        // 2. Deleta limite se existir
        const limitId = (name || "").toLowerCase().trim().replace(/\s+/g, '_');
        await deleteDoc(doc(userRef, "limits", limitId));
        break;
      }

      case 'CREATE_DEBT': {
        await addDoc(collection(userRef, "debts"), {
          ...event.payload,
          remainingAmount: event.payload.remainingAmount !== undefined ? event.payload.remainingAmount : event.payload.totalAmount,
          status: event.payload.status || 'ATIVA',
          isQA,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'UPDATE_DEBT': {
        const { id, ...updates } = event.payload;
        await updateDoc(doc(userRef, "debts", id), {
          ...updates,
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'DELETE_DEBT': {
        const { id } = event.payload;
        await deleteDoc(doc(userRef, "debts", id));
        break;
      }

      case 'REGISTER_DEBT_PAYMENT': {
        const { debtId, amount, date, sourceWalletId } = event.payload;
        
        // 1. Registra o pagamento na subcoleção de pagamentos da dívida
        await addDoc(collection(userRef, "debts", debtId, "payments"), {
          amount,
          date: date || now.toISOString(),
          isQA,
          createdAt: serverTimestamp()
        });

        // 2. Atualiza o saldo restante da dívida
        await updateDoc(doc(userRef, "debts", debtId), {
          remainingAmount: increment(-amount),
          updatedAt: serverTimestamp()
        });

        // 3. Registra como uma despesa no Dashboard
        const debtSnap = await getDoc(doc(userRef, "debts", debtId));
        const debtName = debtSnap.exists() ? debtSnap.data().name : "Dívida";
        
        await addDoc(collection(userRef, "transactions"), {
          description: `Pagamento Dívida: ${debtName}`,
          amount,
          category: 'Dívidas',
          type: 'EXPENSE',
          paymentMethod: 'PIX',
          sourceWalletId: sourceWalletId || null,
          date: date || now.toISOString(),
          isQA,
          createdAt: serverTimestamp()
        });

        // 4. Atualiza saldo da carteira se houver
        if (sourceWalletId) {
          await updateWalletBalance(uid, sourceWalletId, -amount);
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
  const limitId = (category || "").toLowerCase().trim().replace(/\s+/g, '_');
  const limitRef = doc(db, "users", uid, "limits", limitId);
  const snap = await getDoc(limitRef);
  if (snap.exists()) {
    await updateDoc(limitRef, {
      spent: increment(amount),
      updatedAt: serverTimestamp()
    });
  }
}

async function updateWalletBalance(uid: string, walletId: string, amount: number) {
  const walletRef = doc(db, "users", uid, "wallets", walletId);
  const snap = await getDoc(walletRef);
  if (snap.exists()) {
    await updateDoc(walletRef, {
      balance: increment(amount),
      updatedAt: serverTimestamp()
    });
  }
}
