
import { db, auth } from "./firebaseConfig";
import { 
  collection, addDoc, doc, setDoc, deleteDoc, updateDoc, 
  serverTimestamp, increment, getDoc, arrayUnion, getDocs, query, where,
  writeBatch, limit, runTransaction, DocumentReference
} from "firebase/firestore";
import { FinanceEvent, TransactionType } from "../types";
import { normalizeCategoryName } from "./normalizationService";
import { getCategoryId, suggestCategory } from "./categoryService";

async function getWalletInfo(uid: string, walletId: string) {
  if (!walletId) return null;
  const walletRef = doc(db, "users", uid, "wallets", walletId);
  const snap = await getDoc(walletRef);
  if (snap.exists()) {
    return { id: snap.id, name: snap.data().name };
  }
  return null;
}

async function getCategoryInfo(uid: string, categoryName: string, description?: string) {
  let nameToUse = categoryName;
  
  // Se a categoria for vazia ou "Outros", tenta sugerir pelo texto da descrição e histórico
  if (!nameToUse || nameToUse.toLowerCase() === 'outros' || nameToUse === 'null' || nameToUse === 'undefined') {
    if (description) {
      try {
        const patternsSnap = await getDocs(collection(db, "users", uid, "categoryPatterns"));
        const patterns = patternsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        nameToUse = suggestCategory(description, patterns);
      } catch (e) {
        nameToUse = suggestCategory(description);
      }
    } else {
      nameToUse = 'Outros';
    }
  }

  const normalized = normalizeCategoryName(nameToUse);
  const id = getCategoryId(normalized);
  
  // Tenta buscar pelo ID determinístico primeiro (Fonte da Verdade)
  const catRef = doc(db, "users", uid, "categories", id);
  const catSnap = await getDoc(catRef);
  
  if (catSnap.exists()) {
    return { id: catSnap.id, name: catSnap.data().name };
  }

  // Fallback: busca por nome (caso o ID seja diferente por algum motivo legado)
  const q = query(collection(db, "users", uid, "categories"), where("name", "==", normalized), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, name: d.data().name };
  }

  // Se não existe, retorna o ID determinístico e o nome normalizado
  return { id, name: normalized };
}

async function resolveWallet(uid: string, walletId?: string, walletName?: string) {
  if (walletId) {
    const info = await getWalletInfo(uid, walletId);
    if (info) return info;
  }
  
  if (walletName) {
    const q = query(collection(db, "users", uid, "wallets"), where("name", "==", walletName), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, name: d.data().name };
    }
    
    // Auto-create wallet if it doesn't exist (Surgical fix for Onboarding Step 1 & 3)
    try {
      const walletRef = await addDoc(collection(db, "users", uid, "wallets"), {
        name: walletName,
        balance: 0,
        type: 'CHECKING',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log(`GB: Carteira "${walletName}" criada automaticamente.`);
      return { id: walletRef.id, name: walletName };
    } catch (e) {
      console.error("GB: Erro ao criar carteira automática:", e);
    }
  }
  
  return null;
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

const parseSafeDate = (dateStr?: string | null): Date => {
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
};

const getCycleKey = (dateStr?: string) => {
  const d = parseSafeDate(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Cache de operações em processamento para evitar duplicidade (Idempotência)
const activeOperations = new Set<string>();

export const dispatchEvent = async (uid: string, event: FinanceEvent & { operationKey?: string }) => {
  const finalUid = uid || auth.currentUser?.uid;
  const opKey = event.operationKey || (event.payload?.id ? `${event.type}_${event.payload.id}` : null);

  if (opKey) {
    if (activeOperations.has(opKey)) {
      console.warn("GB Dispatch: Operação duplicada bloqueada (Idempotência).", { opKey });
      return { success: false, error: "Operação já em processamento." };
    }
    activeOperations.add(opKey);
  }

  try {
    console.log("[chat] executor start");
    const result = await executeDispatch(finalUid!, event);
    console.log("[chat] executor end", result);
    return result;
  } catch (err) {
    console.error("[chat] error no executor:", err);
    throw err;
  } finally {
    if (opKey) {
      // Pequeno delay para evitar cliques ultra-rápidos que o Set pode não pegar se for async puro
      setTimeout(() => activeOperations.delete(opKey), 1000);
    }
  }
};

const executeDispatch = async (uid: string, event: FinanceEvent) => {
  if (!uid || uid === 'undefined' || uid === 'null') {
    console.error("Event Dispatch Error: Invalid UID", { uid });
    return { success: false, error: "Invalid UID" };
  }

  // Bloqueio de Segurança: Verificar Trial/Assinatura (Fonte da Verdade)
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const now = new Date();
      let hasAccess = false;

      if (userData.role === 'admin') {
        hasAccess = true;
      } else if (userData.subscriptionStatus === 'active') {
        hasAccess = !userData.subscriptionEndsAt || new Date(userData.subscriptionEndsAt) > now;
      } else if (userData.subscriptionStatus === 'trial' && userData.trialEndsAt) {
        hasAccess = new Date(userData.trialEndsAt) > now;
      }

      // Se não tem acesso, bloqueia ações de escrita (exceto UPDATE_USER que pode ser necessário para renovação/onboarding)
      if (!hasAccess && event.type !== 'UPDATE_USER' && event.type !== 'SYNC_DATA') {
        console.warn("GB Dispatch: Ação bloqueada por falta de assinatura ativa.", { uid, type: event.type });
        return { success: false, error: "Assinatura expirada. Por favor, renove seu acesso para realizar esta ação." };
      }
    }
  } catch (e) {
    console.error("GB Dispatch: Erro ao verificar acesso do usuário:", e);
    // Em caso de erro na verificação, permitimos a ação para não travar o app por erro de rede, 
    // mas logamos o erro. O Firestore Rules deve ser a última linha de defesa.
  }

  // Verifica se o usuário autenticado coincide com o UID do evento
  if (auth.currentUser && auth.currentUser.uid !== uid) {
    console.warn("Event Dispatch Warning: UID mismatch - Usando UID solicitado", { authUid: auth.currentUser.uid, eventUid: uid });
  }

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
        const { amount, category, description, paymentMethod, date, cardId, sourceWalletId, sourceWalletName, walletId, walletName } = payload;
        
        if (paymentMethod === 'CARD' || cardId) {
          return await dispatchEvent(uid, {
            ...event,
            type: 'ADD_CARD_CHARGE',
            payload: { ...payload, cardId: cardId || 'default', confirmedBy }
          });
        }

        // Resolve info OUTSIDE transaction
        const catInfo = await getCategoryInfo(uid, category, description);
        let walletInfo = await resolveWallet(uid, sourceWalletId || walletId, sourceWalletName || walletName);
        
        // Se não encontrou carteira, tenta pegar a primeira disponível
        if (!walletInfo) {
          const walletsSnap = await getDocs(collection(userRef, "wallets"));
          if (!walletsSnap.empty) {
            const d = walletsSnap.docs[0];
            walletInfo = { id: d.id, name: d.data().name };
          }
        }

        await runTransaction(db, async (transaction) => {
          const transRef = doc(collection(userRef, "transactions"));
          
          // Determinar paymentMethod se não fornecido
          let finalPaymentMethod = paymentMethod;
          if (!finalPaymentMethod && walletInfo) {
            if (walletInfo.name.toLowerCase().includes('dinheiro')) {
              finalPaymentMethod = 'CASH';
            }
          }

          transaction.set(transRef, {
            amount, 
            category: catInfo.name,
            categoryId: catInfo.id,
            categoryName: catInfo.name,
            description, 
            paymentMethod: finalPaymentMethod || 'PIX',
            type: 'EXPENSE',
            date: parseSafeDate(date).toISOString(),
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

          if (walletInfo?.id) {
            const walletRef = doc(userRef, "wallets", walletInfo.id);
            transaction.update(walletRef, { 
              balance: increment(-amount),
              updatedAt: serverTimestamp()
            });
          }

          const limitId = catInfo.id;
          const limitRef = doc(userRef, "limits", limitId);
          transaction.set(limitRef, {
            category: catInfo.name,
            spent: increment(amount),
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        break;
      }

      case 'ADD_INCOME': {
        let { amount, targetWalletId, targetWalletName, walletId, walletName, description, category, date, paymentMethod, reminderId } = payload;
        
        // Resolve wallet and category OUTSIDE transaction
        const walletInfo = await resolveWallet(uid, targetWalletId || walletId, targetWalletName || walletName);
        const catInfo = await getCategoryInfo(uid, category || 'Recebimento', description);

        await runTransaction(db, async (transaction) => {
          // 1. READS AT THE TOP
          const userSnap = await transaction.get(userRef);
          const userData = userSnap.data();

          let finalAmount = Number(amount);
          let finalDescription = description;
          let finalCategory = catInfo.name;

          // RECUPERAÇÃO DE DADOS DO PERFIL (Caso a IA envie payload incompleto no Onboarding)
          if (!finalAmount || !walletInfo) {
            if (userData?.incomeProfile?.sources?.length > 0) {
              const mainSource = userData.incomeProfile.sources[0];
              finalAmount = finalAmount || mainSource.amountExpected;
              finalDescription = finalDescription || mainSource.description;
              finalCategory = finalCategory || 'Salário';
            }
          }
          
          // Se ainda não tem walletInfo, tenta pegar a primeira disponível (fallback)
          let finalWalletInfo = walletInfo;
          if (!finalWalletInfo) {
            const walletsSnap = await getDocs(collection(userRef, "wallets"));
            if (!walletsSnap.empty) {
              const d = walletsSnap.docs[0];
              finalWalletInfo = { id: d.id, name: d.data().name };
            }
          }
          
          const transRef = doc(collection(userRef, "transactions"));
          
          // 2. WRITES START HERE
          transaction.set(transRef, {
            amount: Number(finalAmount),
            description: finalDescription || "Recebimento confirmado via Chat",
            type: 'INCOME',
            category: finalCategory,
            categoryId: catInfo.id,
            categoryName: catInfo.name,
            walletId: finalWalletInfo?.id || null,
            walletName: finalWalletInfo?.name || null,
            paymentMethod: paymentMethod || 'PIX',
            date: parseSafeDate(date).toISOString(),
            isQA,
            source,
            cycleKey,
            confirmedBy,
            status: 'CONFIRMED',
            resolved: true,
            createdAt: serverTimestamp()
          });

          if (finalWalletInfo?.id) {
            const walletRef = doc(userRef, "wallets", finalWalletInfo.id);
            transaction.update(walletRef, { 
              balance: increment(Number(finalAmount)),
              updatedAt: serverTimestamp()
            });
          }

          // Atualizar lembrete se fornecido (Surgical fix for Step 3)
          if (reminderId) {
            const reminderRef = doc(userRef, "reminders", reminderId);
            transaction.update(reminderRef, {
              isPaid: true,
              status: 'received',
              resolved: true,
              paidAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              confirmationProcessed: true,
              confirmationProcessedAt: serverTimestamp()
            });
          }

          // Idempotência Onboarding: Marcar como processado no perfil do usuário
          if (source === 'onboarding') {
            if (userData?.onboardingStatus) {
              transaction.update(userRef, {
                "onboardingStatus.chatContextResponded": true,
                "onboardingStatus.onboardingIncomeProcessed": true,
                "onboardingStatus.salaryConfirmed": true,
                updatedAt: serverTimestamp()
              });
            }
          }
        });
        break;
      }

      case 'ADD_CARD_CHARGE': {
        let { amount, category, description, cardId, date, sourceWalletId, installments } = payload;
        const catInfo = await getCategoryInfo(uid, category, description);
        const chargeDate = parseSafeDate(date);
        const numInstallments = Math.max(1, installments || 1);
        const installmentAmount = Number((amount / numInstallments).toFixed(2));
        
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

          // Controle de fatura atual
          let amountToCurrentInvoice = 0;
          const now = new Date();
          const currentCycleKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

          for (let i = 0; i < numInstallments; i++) {
            const currentInstallmentDate = new Date(chargeDate);
            // Correção do pulo de mês: define dia 1 antes de mudar o mês
            currentInstallmentDate.setDate(1);
            currentInstallmentDate.setMonth(chargeDate.getMonth() + i);
            // Restaura o dia original ou o último dia do mês alvo
            const lastDayOfTargetMonth = new Date(currentInstallmentDate.getFullYear(), currentInstallmentDate.getMonth() + 1, 0).getDate();
            currentInstallmentDate.setDate(Math.min(chargeDate.getDate(), lastDayOfTargetMonth));
            
            const d = new Date(currentInstallmentDate);
            if (d.getDate() > closingDay) {
              d.setMonth(d.getMonth() + 1);
            }
            const invoiceCycle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            if (invoiceCycle === currentCycleKey) {
              amountToCurrentInvoice += installmentAmount;
            }

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
            currentInvoiceAmount: increment(amountToCurrentInvoice),
            usedAmount: increment(amount),
            availableAmount: increment(-amount),
            invoiceAmount: increment(amountToCurrentInvoice),
            updatedAt: serverTimestamp()
          });

          const limitId = catInfo.id;
          const limitRef = doc(userRef, "limits", limitId);
          batch.set(limitRef, {
            category: catInfo.name,
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
        const limitId = getCategoryId(normalizedCat);
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
        const { description, amount, dueDay, category, type, recurring, targetWalletName, dedupeKey } = payload;
        const catInfo = await getCategoryInfo(uid, category || (type === 'RECEIVE' ? 'Recebimento' : 'Contas'), description);
        
        // Garantir que dueDay seja um número válido
        const day = Number(dueDay) || 1;
        const safeDay = Math.min(Math.max(1, day), 31); 
        
        // Normalização de data para evitar pulo de mês (ex: dia 31 em fevereiro)
        const targetDate = new Date(now.getFullYear(), now.getMonth(), safeDay);
        if (targetDate.getMonth() !== now.getMonth()) {
          targetDate.setDate(0); // Vai para o último dia do mês correto
        }
        const dueDate = targetDate.toISOString();
        
        const reminderData = {
          description, 
          amount: Number(amount), 
          dueDay: targetDate.getDate(), 
          category: catInfo.name,
          categoryId: catInfo.id,
          categoryName: catInfo.name,
          dueDate, 
          isPaid: false, 
          recurring: recurring !== undefined ? recurring : true,
          type: type || 'PAY',
          targetWalletName: targetWalletName || null,
          isQA,
          source,
          cycleKey,
          confirmedBy,
          status: 'PENDING',
          resolved: false,
          updatedAt: serverTimestamp(),
          isActive: true,
          dedupeKey: dedupeKey || null
        };

        if (dedupeKey) {
          const q = query(collection(userRef, "reminders"), where("dedupeKey", "==", dedupeKey), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(userRef, "reminders", snap.docs[0].id), reminderData);
            console.log(`GB: Lembrete com dedupeKey "${dedupeKey}" atualizado.`);
            break;
          }
        }

        await addDoc(collection(userRef, "reminders"), {
          ...reminderData,
          createdAt: serverTimestamp()
        });
        break;
      }

      case 'PAY_REMINDER': {
        const billId = payload.billId || payload.id;
        const { paymentMethod, sourceWalletId, cardId } = payload;
        if (!billId) {
          console.error("GB: PAY_REMINDER sem ID no payload");
          break;
        }
        const billRef = doc(userRef, "reminders", billId);
        const billSnap = await getDoc(billRef);
        
        if (billSnap.exists()) {
          const billData = billSnap.data();
          
          // Idempotência: Se já foi pago ou processado, ignora
          if (billData.isPaid || billData.status === 'paid' || billData.status === 'received' || billData.confirmationProcessed) {
            console.warn("GB: PAY_REMINDER ignorado - Já processado anteriormente.", { billId });
            return { success: true, message: "Já processado." };
          }

          const isReceive = billData.type === 'RECEIVE';
          const cycleKey = getCycleKey();
          
          batch.update(billRef, { 
            isPaid: true, 
            paidAt: now.toISOString(),
            status: isReceive ? 'received' : 'paid',
            resolved: true,
            lastPromptedAt: serverTimestamp(),
            confirmationProcessed: true,
            confirmationProcessedAt: serverTimestamp(),
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
            const limitId = getCategoryId(normalizedCat);
            const limitRef = doc(userRef, "limits", limitId);
            batch.set(limitRef, {
              category: normalizedCat,
              spent: increment(billData.amount),
              updatedAt: serverTimestamp()
            }, { merge: true });
          }

            // Se for recorrente, cria o do próximo mês
            if (billData.recurring) {
              const currentDueDate = billData.dueDate ? parseSafeDate(billData.dueDate) : new Date();
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
          const q = query(collection(userRef, "goals"), where("name", "==", name));
          const snap = await getDocs(q);
          if (!snap.empty) {
            goalId = snap.docs[0].id;
          }
        }

        if (!goalId) return { success: false, error: "Goal not found" };

        const goalRef = doc(userRef, "goals", goalId);
        const goalSnap = await getDoc(goalRef);
        if (!goalSnap.exists()) return { success: false, error: "Goal not found" };
        
        const goalData = goalSnap.data();
        const newAmount = (goalData.currentAmount || 0) + amount;
        const isCompleted = newAmount >= (goalData.targetAmount || 0);

        await updateDoc(goalRef, {
          currentAmount: newAmount,
          status: isCompleted ? 'CONCLUÍDA' : (goalData.status || 'ACTIVE'),
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

      case 'DELETE_REMINDER_BY_DEDUPE': {
        const { dedupeKey } = event.payload;
        if (!dedupeKey) throw new Error("dedupeKey is required");
        const q = query(collection(userRef, "reminders"), where("dedupeKey", "==", dedupeKey));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        break;
      }

      case 'UPDATE_TRANSACTION': {
        const { id, updates, oldData } = payload;
        const transRef = doc(userRef, "transactions", id);
        
        await runTransaction(db, async (transaction) => {
          // 1. READS FIRST
          let currentData = oldData;
          const transSnap = !currentData ? await transaction.get(transRef) : null;
          if (transSnap?.exists()) currentData = transSnap.data();

          if (!currentData) throw new Error("Transação não encontrada para atualização");

          const finalUpdates = { ...(updates || {}) };
          
          // Resolve info OUTSIDE transaction if possible, but here we are inside.
          // These helpers (getCategoryInfo, getWalletInfo) use getDoc/getDocs, NOT transaction.get.
          // This is technically a "read" but not a "transaction read". 
          // However, to be safe and consistent, we should avoid them inside if they perform writes later.
          // Actually, they are async functions.
          
          if (finalUpdates.category) {
            const catInfo = await getCategoryInfo(uid, finalUpdates.category);
            finalUpdates.category = catInfo.name;
            finalUpdates.categoryId = catInfo.id;
            finalUpdates.categoryName = catInfo.name;
          }

          const newWalletId = finalUpdates.sourceWalletId || finalUpdates.targetWalletId;
          if (newWalletId) {
            const walletInfo = await getWalletInfo(uid, newWalletId);
            finalUpdates.walletId = walletInfo?.id || null;
            finalUpdates.walletName = walletInfo?.name || null;
          }

          if (finalUpdates.date) {
            finalUpdates.date = parseSafeDate(finalUpdates.date).toISOString();
          }

          const oldAmount = Number(currentData.amount || 0);
          const newAmount = finalUpdates.amount !== undefined ? Number(finalUpdates.amount) : oldAmount;
          const oldType = currentData.type;
          const newType = finalUpdates.type || oldType;
          const oldMethod = currentData.paymentMethod;
          const newMethod = finalUpdates.paymentMethod || oldMethod;
          const oldSourceWalletId = currentData.sourceWalletId || currentData.walletId || currentData.fromWalletId;
          const newSourceWalletId = finalUpdates.sourceWalletId !== undefined ? finalUpdates.sourceWalletId : (finalUpdates.walletId || finalUpdates.fromWalletId || oldSourceWalletId);
          const oldTargetWalletId = currentData.targetWalletId || currentData.toWalletId;
          const newTargetWalletId = finalUpdates.targetWalletId !== undefined ? finalUpdates.targetWalletId : (finalUpdates.toWalletId || oldTargetWalletId);

          const oldCat = normalizeCategoryName(currentData.category);
          const newCat = finalUpdates.category || oldCat;
          const oldCardId = currentData?.cardId;
          const newCardId = finalUpdates.cardId || oldCardId;

          // Collect all refs to read
          const refsToRead: DocumentReference[] = [];
          
          if (oldTargetWalletId) refsToRead.push(doc(userRef, "wallets", oldTargetWalletId));
          if (oldSourceWalletId && oldSourceWalletId !== oldTargetWalletId) refsToRead.push(doc(userRef, "wallets", oldSourceWalletId));
          if (newTargetWalletId && newTargetWalletId !== oldTargetWalletId && newTargetWalletId !== oldSourceWalletId) refsToRead.push(doc(userRef, "wallets", newTargetWalletId));
          if (newSourceWalletId && newSourceWalletId !== oldTargetWalletId && newSourceWalletId !== oldSourceWalletId && newSourceWalletId !== newTargetWalletId) refsToRead.push(doc(userRef, "wallets", newSourceWalletId));
          
          const oldLimitId = (oldCat || "").toLowerCase().trim().replace(/\s+/g, '_');
          const newLimitId = (newCat || "").toLowerCase().trim().replace(/\s+/g, '_');
          if (oldLimitId) refsToRead.push(doc(userRef, "limits", oldLimitId));
          if (newLimitId && newLimitId !== oldLimitId) refsToRead.push(doc(userRef, "limits", newLimitId));

          if (oldCardId) refsToRead.push(doc(userRef, "cards", oldCardId));
          if (newCardId && newCardId !== oldCardId) refsToRead.push(doc(userRef, "cards", newCardId));

          // Perform all reads at once
          const snaps = await Promise.all(refsToRead.map(ref => transaction.get(ref)));
          const snapMap = new Map(snaps.map((s, i) => [refsToRead[i].path, s]));

          // 2. NOW PERFORM WRITES

          // Reverter impacto antigo
          if (oldType === 'INCOME' && oldTargetWalletId) {
            const walletRef = doc(userRef, "wallets", oldTargetWalletId);
            const walletSnap = snapMap.get(walletRef.path);
            if (walletSnap?.exists()) {
              transaction.update(walletRef, { balance: increment(-oldAmount), updatedAt: serverTimestamp() });
            }
          } else if (oldType === 'EXPENSE' && oldSourceWalletId && oldMethod !== 'CARD') {
            const walletRef = doc(userRef, "wallets", oldSourceWalletId);
            const walletSnap = snapMap.get(walletRef.path);
            if (walletSnap?.exists()) {
              transaction.update(walletRef, { balance: increment(oldAmount), updatedAt: serverTimestamp() });
            }
          } else if (oldType === 'TRANSFER' && oldSourceWalletId && oldTargetWalletId) {
            const fromRef = doc(userRef, "wallets", oldSourceWalletId);
            const toRef = doc(userRef, "wallets", oldTargetWalletId);
            const fromSnap = snapMap.get(fromRef.path);
            const toSnap = snapMap.get(toRef.path);
            if (fromSnap?.exists()) transaction.update(fromRef, { balance: increment(oldAmount), updatedAt: serverTimestamp() });
            if (toSnap?.exists()) transaction.update(toRef, { balance: increment(-oldAmount), updatedAt: serverTimestamp() });
          }

          // Aplicar novo impacto
          if (newType === 'INCOME' && newTargetWalletId) {
            const walletRef = doc(userRef, "wallets", newTargetWalletId);
            const walletSnap = snapMap.get(walletRef.path);
            if (walletSnap?.exists()) {
              transaction.update(walletRef, { balance: increment(newAmount), updatedAt: serverTimestamp() });
            }
          } else if (newType === 'EXPENSE' && newSourceWalletId && newMethod !== 'CARD') {
            const walletRef = doc(userRef, "wallets", newSourceWalletId);
            const walletSnap = snapMap.get(walletRef.path);
            if (walletSnap?.exists()) {
              transaction.update(walletRef, { balance: increment(-newAmount), updatedAt: serverTimestamp() });
            }
          } else if (newType === 'TRANSFER' && newSourceWalletId && newTargetWalletId) {
            const fromRef = doc(userRef, "wallets", newSourceWalletId);
            const toRef = doc(userRef, "wallets", newTargetWalletId);
            const fromSnap = snapMap.get(fromRef.path);
            const toSnap = snapMap.get(toRef.path);
            if (fromSnap?.exists()) transaction.update(fromRef, { balance: increment(-newAmount), updatedAt: serverTimestamp() });
            if (toSnap?.exists()) transaction.update(toRef, { balance: increment(newAmount), updatedAt: serverTimestamp() });
          }

          // 4. Sincronização de Limites
          if (oldCat === newCat) {
            if (oldAmount !== newAmount && (oldType === 'EXPENSE' || newType === 'EXPENSE')) {
              const limitRef = doc(userRef, "limits", oldLimitId);
              const limitSnap = snapMap.get(limitRef.path);
              if (limitSnap?.exists()) {
                transaction.update(limitRef, { spent: increment(newAmount - oldAmount), updatedAt: serverTimestamp() });
              }
            }
          } else {
            if (oldType === 'EXPENSE') {
              const oldLimitRef = doc(userRef, "limits", oldLimitId);
              const oldLimitSnap = snapMap.get(oldLimitRef.path);
              if (oldLimitSnap?.exists()) {
                transaction.update(oldLimitRef, { spent: increment(-oldAmount), updatedAt: serverTimestamp() });
              }
            }
            if (newType === 'EXPENSE') {
              const newLimitRef = doc(userRef, "limits", newLimitId);
              const newLimitSnap = snapMap.get(newLimitRef.path);
              if (newLimitSnap?.exists()) {
                transaction.update(newLimitRef, { spent: increment(newAmount), updatedAt: serverTimestamp() });
              }
            }
          }

          // 5. Ajuste de Cartão de Crédito
          if (oldMethod === 'CARD' && newMethod === 'CARD') {
            if (oldCardId === newCardId) {
              if (oldAmount !== newAmount) {
                const cardRef = doc(userRef, "cards", oldCardId);
                const diff = newAmount - oldAmount;
                const cardSnap = snapMap.get(cardRef.path);
                if (cardSnap?.exists()) {
                  transaction.update(cardRef, {
                    usedLimit: increment(diff),
                    availableLimit: increment(-diff),
                    currentInvoiceAmount: increment(diff),
                    usedAmount: increment(diff),
                    availableAmount: increment(-diff),
                    invoiceAmount: increment(diff),
                    updatedAt: serverTimestamp()
                  });
                }
              }
            } else {
              if (oldCardId) {
                const oldCardRef = doc(userRef, "cards", oldCardId);
                const oldCardSnap = snapMap.get(oldCardRef.path);
                if (oldCardSnap?.exists()) {
                  transaction.update(oldCardRef, {
                    usedLimit: increment(-oldAmount),
                    availableLimit: increment(oldAmount),
                    currentInvoiceAmount: increment(-oldAmount),
                    usedAmount: increment(-oldAmount),
                    availableAmount: increment(oldAmount),
                    invoiceAmount: increment(-oldAmount),
                    updatedAt: serverTimestamp()
                  });
                }
              }
              if (newCardId) {
                const newCardRef = doc(userRef, "cards", newCardId);
                const newCardSnap = snapMap.get(newCardRef.path);
                if (newCardSnap?.exists()) {
                  transaction.update(newCardRef, {
                    usedLimit: increment(newAmount),
                    availableLimit: increment(-newAmount),
                    currentInvoiceAmount: increment(newAmount),
                    usedAmount: increment(newAmount),
                    availableAmount: increment(-newAmount),
                    invoiceAmount: increment(newAmount),
                    updatedAt: serverTimestamp()
                  });
                }
              }
            }
          } else if (oldMethod !== 'CARD' && newMethod === 'CARD') {
            if (newCardId) {
              const newCardRef = doc(userRef, "cards", newCardId);
              const newCardSnap = snapMap.get(newCardRef.path);
              if (newCardSnap?.exists()) {
                transaction.update(newCardRef, {
                  usedLimit: increment(newAmount),
                  availableLimit: increment(-newAmount),
                  currentInvoiceAmount: increment(newAmount),
                  usedAmount: increment(newAmount),
                  availableAmount: increment(-newAmount),
                  invoiceAmount: increment(newAmount),
                  updatedAt: serverTimestamp()
                });
              }
            }
          } else if (oldMethod === 'CARD' && newMethod !== 'CARD') {
            if (oldCardId) {
              const oldCardRef = doc(userRef, "cards", oldCardId);
              const oldCardSnap = snapMap.get(oldCardRef.path);
              if (oldCardSnap?.exists()) {
                transaction.update(oldCardRef, {
                  usedLimit: increment(-oldAmount),
                  availableLimit: increment(oldAmount),
                  currentInvoiceAmount: increment(-oldAmount),
                  usedAmount: increment(-oldAmount),
                  availableAmount: increment(oldAmount),
                  invoiceAmount: increment(-oldAmount),
                  updatedAt: serverTimestamp()
                });
              }
            }
          }

          // 6. Atualização final do documento
          transaction.update(transRef, {
            ...finalUpdates,
            updatedAt: serverTimestamp()
          });
        });
        break;
      }

      case 'DELETE_ITEM': {
        const { id, collection: colName } = event.payload;
        let { oldData } = event.payload;
        if (!id || !colName) throw new Error("ID and collection are required for DELETE_ITEM");
        
        const itemRef = doc(userRef, colName, id);
        
        if (colName === 'transactions') {
          await runTransaction(db, async (transaction) => {
            // 1. READS FIRST
            let data = oldData;
            const itemSnap = !data ? await transaction.get(itemRef) : null;
            if (itemSnap?.exists()) data = itemSnap.data();

            if (!data) {
              transaction.delete(itemRef);
              return;
            }

            const amount = Number(data.amount || 0);
            const normalizedCat = normalizeCategoryName(data.category);
            const limitId = (normalizedCat || "").toLowerCase().trim().replace(/\s+/g, '_');
            const cardId = data.cardId;
            const walletId = data.walletId || data.sourceWalletId || data.targetWalletId || data.fromWalletId;
            const targetWalletId = data.targetWalletId || data.toWalletId;

            const refsToRead: DocumentReference[] = [];
            if (limitId) refsToRead.push(doc(userRef, "limits", limitId));
            if (cardId) refsToRead.push(doc(userRef, "cards", cardId));
            if (walletId) refsToRead.push(doc(userRef, "wallets", walletId));
            if (targetWalletId && targetWalletId !== walletId) refsToRead.push(doc(userRef, "wallets", targetWalletId));

            const snaps = await Promise.all(refsToRead.map(ref => transaction.get(ref)));
            const snapMap = new Map(snaps.map((s, i) => [refsToRead[i].path, s]));

            // 2. NOW PERFORM WRITES

            // 1. Estorno de Limite de Categoria
            if (data.type === 'EXPENSE' && limitId) {
              const limitRef = doc(userRef, "limits", limitId);
              const limitSnap = snapMap.get(limitRef.path);
              if (limitSnap?.exists()) {
                transaction.update(limitRef, {
                  spent: increment(-amount),
                  updatedAt: serverTimestamp()
                });
              }
            }

            // 2. Estorno de Cartão de Crédito
            if (data.type === 'EXPENSE' && data.paymentMethod === 'CARD' && cardId) {
              const cardRef = doc(userRef, "cards", cardId);
              const cardSnap = snapMap.get(cardRef.path);
              if (cardSnap?.exists()) {
                transaction.update(cardRef, {
                  usedLimit: increment(-amount),
                  availableLimit: increment(amount),
                  currentInvoiceAmount: increment(-amount),
                  usedAmount: increment(-amount),
                  availableAmount: increment(amount),
                  invoiceAmount: increment(-amount),
                  updatedAt: serverTimestamp()
                });
              }
            }

            // 3. Estorno de Carteira (Wallet)
            if (data.type === 'TRANSFER' && walletId && targetWalletId) {
              const fromRef = doc(userRef, "wallets", walletId);
              const toRef = doc(userRef, "wallets", targetWalletId);
              const fromSnap = snapMap.get(fromRef.path);
              const toSnap = snapMap.get(toRef.path);
              if (fromSnap?.exists()) transaction.update(fromRef, { balance: increment(amount), updatedAt: serverTimestamp() });
              if (toSnap?.exists()) transaction.update(toRef, { balance: increment(-amount), updatedAt: serverTimestamp() });
            } else if (walletId) {
              const walletRef = doc(userRef, "wallets", walletId);
              const walletSnap = snapMap.get(walletRef.path);
              if (walletSnap?.exists()) {
                if (data.type === 'INCOME') {
                  transaction.update(walletRef, { 
                    balance: increment(-amount),
                    updatedAt: serverTimestamp()
                  });
                } else if (data.type === 'EXPENSE' && data.paymentMethod !== 'CARD') {
                  transaction.update(walletRef, { 
                    balance: increment(amount),
                    updatedAt: serverTimestamp()
                  });
                }
              }
            }

            // 4. Deleção principal
            transaction.delete(itemRef);
          });

          // 5. Deleção em Cascata para Parcelamentos (fora da transação principal)
          try {
            if (oldData?.originalAmount && oldData?.totalInstallments > 1) {
              const descriptionPrefix = (oldData.description || "").split(" (")[0];
              const q = query(
                collection(userRef, "transactions"), 
                where("description", ">=", descriptionPrefix),
                where("description", "<=", descriptionPrefix + "\uf8ff"),
                where("originalAmount", "==", oldData.originalAmount),
                where("totalInstallments", "==", oldData.totalInstallments)
              );
              const snap = await getDocs(q);
              if (!snap.empty) {
                const batch = writeBatch(db);
                snap.docs.forEach(d => {
                  if (d.id !== id) batch.delete(d.ref);
                });
                await batch.commit();
              }
            }
          } catch (cascadeErr) {
            console.error("GB: Erro na deleção em cascata:", cascadeErr);
          }
        } else {
          await deleteDoc(itemRef);
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
        const { name } = payload;
        const q = query(collection(userRef, "wallets"), where("name", "==", name), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(collection(userRef, "wallets"), {
            ...payload,
            isActive: true,
            isQA,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log(`GB: Carteira "${name}" criada com sucesso.`);
        } else {
          console.log(`GB: Carteira "${name}" já existe.`);
        }
        break;
      }

      case 'UPDATE_USER': {
        await setDoc(userRef, {
          ...payload,
          updatedAt: serverTimestamp()
        }, { merge: true });
        break;
      }

      case 'UPDATE_WALLET': {
        const { id, ...updates } = payload;
        await updateDoc(doc(userRef, "wallets", id), {
          ...updates,
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'DELETE_WALLET': {
        const { id } = payload;
        await updateDoc(doc(userRef, "wallets", id), {
          isActive: false,
          updatedAt: serverTimestamp()
        });
        break;
      }

      case 'TRANSFER_WALLET': {
        const { fromWalletId, toWalletId, sourceWalletId, targetWalletId, fromWalletName, toWalletName, sourceWalletName, targetWalletName, amount, note, description, date } = payload;
        
        // Resolve wallet IDs from names if IDs are missing
        const walletFromInfo = await resolveWallet(uid, fromWalletId || sourceWalletId, fromWalletName || sourceWalletName);
        const walletToInfo = await resolveWallet(uid, toWalletId || targetWalletId, toWalletName || targetWalletName);

        const finalFrom = walletFromInfo?.id;
        const finalTo = walletToInfo?.id;
        const finalNote = note || description || "Transferência";

        if (!finalFrom || !finalTo) {
          throw new Error("Origem ou destino da transferência não encontrados ou não informados.");
        }

        if (finalFrom === finalTo) {
          throw new Error("A carteira de origem e destino não podem ser iguais.");
        }
        
        await runTransaction(db, async (transaction) => {
          const fromRef = doc(userRef, "wallets", finalFrom);
          const toRef = doc(userRef, "wallets", finalTo);
          
          const fromSnap = await transaction.get(fromRef);
          const toSnap = await transaction.get(toRef);
          
          if (!fromSnap.exists()) throw new Error("Carteira de origem não encontrada.");
          if (!toSnap.exists()) throw new Error("Carteira de destino não encontrada.");

          // 1. Decrementa da origem
          transaction.update(fromRef, {
            balance: increment(-amount),
            updatedAt: serverTimestamp()
          });

          // 2. Incrementa no destino
          transaction.update(toRef, {
            balance: increment(amount),
            updatedAt: serverTimestamp()
          });

          // 3. Registra a transferência
          const transferRef = doc(collection(userRef, "walletTransfers"));
          transaction.set(transferRef, {
            fromWalletId: finalFrom, 
            fromWalletName: fromSnap.data().name,
            toWalletId: finalTo, 
            toWalletName: toSnap.data().name,
            amount, 
            note: finalNote, 
            date: parseSafeDate(date || new Date()).toISOString(),
            isQA,
            createdAt: serverTimestamp()
          });

          // 4. Registra no extrato como uma transação especial
          const transRef = doc(collection(userRef, "transactions"));
          transaction.set(transRef, {
            description: `Transferência: ${fromSnap.data().name} ➔ ${toSnap.data().name}`,
            amount,
            type: 'TRANSFER',
            category: 'Transferência',
            fromWalletId: finalFrom,
            toWalletId: finalTo,
            date: parseSafeDate(date || new Date()).toISOString(),
            isQA,
            source,
            createdAt: serverTimestamp()
          });
        });
        break;
      }

      case 'CREATE_CATEGORY': {
        const { name } = payload;
        const normalizedName = normalizeCategoryName(name);
        const id = getCategoryId(normalizedName);
        
        await setDoc(doc(userRef, "categories", id), {
          ...payload,
          name: normalizedName,
          isQA,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
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
          const oldNormalized = normalizeCategoryName(oldName);
          const newNormalized = normalizeCategoryName(newName);
          const oldLimitId = getCategoryId(oldNormalized);
          const newLimitId = getCategoryId(newNormalized);
          
          // 1. Atualiza transações em lote
          const q = query(collection(userRef, "transactions"), where("category", "==", oldName));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          let count = 0;
          
          for (const d of snap.docs) {
            batch.update(doc(userRef, "transactions", d.id), { 
              category: newNormalized,
              categoryName: newNormalized,
              categoryId: newLimitId
            });
            count++;
            if (count >= 450) {
              await batch.commit();
              count = 0;
            }
          }
          if (count > 0) await batch.commit();

          // 2. Migra limite se existir
          const oldLimitRef = doc(userRef, "limits", oldLimitId);
          const oldLimitSnap = await getDoc(oldLimitRef);
          
          if (oldLimitSnap.exists()) {
            const limitData = oldLimitSnap.data();
            await setDoc(doc(userRef, "limits", newLimitId), {
              ...limitData,
              category: newNormalized,
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
          await updateDoc(doc(userRef, "transactions", d.id), { 
            category: "Outros",
            categoryName: "Outros",
            categoryId: "outros"
          });
        }

        // 2. Deleta limite se existir
        const limitId = getCategoryId(name);
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
          date: parseSafeDate(date || new Date()).toISOString(),
          isQA,
          createdAt: serverTimestamp()
        });

        // 2. Atualiza o saldo restante da dívida e status
        const debtRef = doc(userRef, "debts", debtId);
        const debtSnap = await getDoc(debtRef);
        if (debtSnap.exists()) {
          const debtData = debtSnap.data();
          const newRemaining = (debtData.remainingAmount || 0) - amount;
          const isPaid = newRemaining <= 0;

          await updateDoc(debtRef, {
            remainingAmount: Math.max(0, newRemaining),
            status: isPaid ? 'PAGA' : (debtData.status || 'ATIVA'),
            updatedAt: serverTimestamp()
          });

          // 3. Registra como uma despesa no Dashboard
          const debtName = debtData.name || "Dívida";
          
          await addDoc(collection(userRef, "transactions"), {
            description: `Pagamento Dívida: ${debtName}`,
            amount,
            category: 'Dívidas',
            type: 'EXPENSE',
            paymentMethod: 'PIX',
            sourceWalletId: sourceWalletId || null,
            date: parseSafeDate(date || new Date()).toISOString(),
            isQA,
            createdAt: serverTimestamp()
          });
        }

        // 4. Atualiza saldo da carteira se houver
        if (sourceWalletId) {
          await updateWalletBalance(uid, sourceWalletId, -amount);
        }
        break;
      }

      case 'UPDATE_ONBOARDING': {
        const { status } = payload;
        await setDoc(userRef, {
          onboardingStatus: {
            ...status,
            updatedAt: serverTimestamp()
          }
        }, { merge: true });
        break;
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Event Dispatch Error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
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
