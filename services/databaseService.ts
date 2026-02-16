
import { db, isFirebaseConfigured } from "./firebaseConfig";
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, query, orderBy, deleteDoc } from "firebase/firestore";
import { CustomerData } from "../types";

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
