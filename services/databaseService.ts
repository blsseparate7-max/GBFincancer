
import { db, isFirebaseConfigured } from "./firebaseConfig";
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
  if (!uid || !isFirebaseConfigured() || !db) return null;

  try {
    const userRef = doc(db, MAIN_COLLECTION, uid);
    
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
      getDoc(userRef),
      getDocs(query(collection(userRef, "transactions"), orderBy("date", "desc"), limit(50))),
      getDocs(collection(userRef, "goals")),
      getDocs(collection(userRef, "reminders")),
      getDocs(collection(userRef, "limits")),
      getDocs(collection(userRef, "cards")),
      getDocs(collection(userRef, "wallets")),
      getDocs(collection(userRef, "categories")),
      getDocs(collection(userRef, "debts"))
    ]);

    return {
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
