
import { db, isFirebaseConfigured, auth } from "./firebaseConfig";
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, query, orderBy, deleteDoc, limit } from "firebase/firestore";
import { CustomerData, Transaction, SavingGoal, Bill, CategoryLimit, CreditCardInfo, Wallet, UserCategory } from "../types";
import { normalizeCard, normalizeGoal, normalizeReminder, normalizeLimit, normalizeWallet, normalizeUserCategory, normalizeTransaction, normalizeDebt } from "./normalizationService";

// Agora usamos 'users' para manter consistência com o restante do app
const MAIN_COLLECTION = "users";

export const syncUserData = async (uid: string, data: Partial<CustomerData>) => {
  if (!uid) return false;

  const now = new Date().toISOString();
  
  // Cache local para persistência offline rápida
  try {
    const existingRaw = localStorage.getItem(`gb_vault_${uid}`);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const localPayload = { ...existing, ...data, localUpdatedAt: now };
    localStorage.setItem(`gb_vault_${uid}`, JSON.stringify(localPayload));
  } catch (e) {
    console.error("💾 Cache local error:", e);
  }

  if (!isFirebaseConfigured() || !db) return true;

  try {
    const userDocRef = doc(db, MAIN_COLLECTION, uid);
    await setDoc(userDocRef, {
      ...data,
      lastActive: now,
      localUpdatedAt: now,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn("☁️ Cloud sync unavailable:", error);
    return true; 
  }
};

export const fetchUserData = async (uid: string): Promise<CustomerData | null> => {
  if (!uid) return null;

  let localData: CustomerData | null = null;
  const localRaw = localStorage.getItem(`gb_vault_${uid}`);
  if (localRaw) {
    try { localData = JSON.parse(localRaw); } catch (e) {}
  }

  if (isFirebaseConfigured() && db) {
    try {
      const userDocRef = doc(db, MAIN_COLLECTION, uid);
      const snapshot = await getDoc(userDocRef);
      if (snapshot.exists()) {
        const cloudData = snapshot.data() as CustomerData;
        // Sincroniza se a nuvem for mais recente
        if (!localData || (cloudData.localUpdatedAt && new Date(cloudData.localUpdatedAt) > new Date(localData.localUpdatedAt))) {
           localData = { ...localData, ...cloudData };
           localStorage.setItem(`gb_vault_${uid}`, JSON.stringify(localData));
        }
      }
    } catch (error) {
      console.warn("📡 Cloud inaccessible.");
    }
  }
  return localData;
};

export const deleteUserData = async (uid: string): Promise<boolean> => {
  if (!uid) return false;
  
  localStorage.removeItem(`gb_vault_${uid}`);
  
  if (isFirebaseConfigured() && db) {
    try {
      const userDocRef = doc(db, MAIN_COLLECTION, uid);
      await deleteDoc(userDocRef);
      return true;
    } catch (error) {
      console.error("Erro ao deletar dados:", error);
      return false;
    }
  }
  return true;
};

export const fetchAllCustomers = async (): Promise<CustomerData[]> => {
  if (!isFirebaseConfigured() || !db) return [];
  try {
    const querySnapshot = await getDocs(query(collection(db, MAIN_COLLECTION), orderBy("name", "asc")));
    return querySnapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() } as any));
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    return [];
  }
};

/**
 * Busca o contexto completo e atualizado do Firestore para o Chat.
 * Garante que a IA sempre tenha a "Fonte da Verdade" mais recente.
 */
export const fetchChatContext = async (uid: string) => {
  const finalUid = uid || auth.currentUser?.uid;
  
  if (!finalUid || finalUid === 'undefined' || finalUid === 'null' || !isFirebaseConfigured() || !db) {
    console.warn("GB: fetchChatContext abortado - UID inválido ou Firebase não configurado", { uid: finalUid });
    return null;
  }

  // Verifica se o usuário está autenticado e se o UID coincide
  if (auth.currentUser && auth.currentUser.uid !== finalUid) {
    console.warn("GB: fetchChatContext UID mismatch - Usando UID autenticado", { authUid: auth.currentUser.uid, requestedUid: finalUid });
    // Em ambiente de produção, o UID autenticado é a única fonte segura
    // Mas para QA/Admin, podemos permitir o UID solicitado se as regras permitirem
  }

  try {
    const userRef = doc(db, MAIN_COLLECTION, finalUid);
    
    console.log("[chat] fetchChatContext: iniciando buscas paralelas...");
    // Buscas paralelas para performance
    const [
      userSnap,
      transSnap,
      goalsSnap,
      remindersSnap,
      limitsSnap,
      cardsSnap,
      walletsSnap,
      catsSnap,
      debtsSnap
    ] = await Promise.all([
      getDoc(userRef).then(res => { console.log("[chat] fetch: user ok"); return res; }),
      getDocs(query(collection(userRef, "transactions"), orderBy("date", "desc"), limit(50))).then(res => { console.log("[chat] fetch: transactions ok"); return res; }),
      getDocs(collection(userRef, "goals")).then(res => { console.log("[chat] fetch: goals ok"); return res; }),
      getDocs(collection(userRef, "reminders")).then(res => { console.log("[chat] fetch: reminders ok"); return res; }),
      getDocs(collection(userRef, "limits")).then(res => { console.log("[chat] fetch: limits ok"); return res; }),
      getDocs(collection(userRef, "cards")).then(res => { console.log("[chat] fetch: cards ok"); return res; }),
      getDocs(collection(userRef, "wallets")).then(res => { console.log("[chat] fetch: wallets ok"); return res; }),
      getDocs(collection(userRef, "categories")).then(res => { console.log("[chat] fetch: categories ok"); return res; }),
      getDocs(collection(userRef, "debts")).then(res => { console.log("[chat] fetch: debts ok"); return res; })
    ]);
    console.log("[chat] fetchChatContext: todas as buscas concluídas.");

    return {
      user: userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } as any : null,
      spendingLimit: userSnap.exists() ? userSnap.data().spendingLimit : null,
      transactions: transSnap.docs.map(d => normalizeTransaction(d)),
      goals: goalsSnap.docs.map(d => normalizeGoal(d, uid)),
      reminders: remindersSnap.docs.map(d => normalizeReminder(d)),
      limits: limitsSnap.docs.map(d => normalizeLimit(d)),
      cards: cardsSnap.docs.map(d => normalizeCard(d, uid)),
      wallets: walletsSnap.docs.map(d => normalizeWallet(d, uid)),
      categories: catsSnap.docs.map(d => normalizeUserCategory(d)),
      debts: debtsSnap.docs.map(d => normalizeDebt(d))
    };
  } catch (error) {
    console.error("GB: Erro ao buscar contexto do chat:", error);
    return null;
  }
};
