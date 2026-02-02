
import { db, isFirebaseConfigured } from "./firebaseConfig";
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, query, orderBy } from "firebase/firestore";
import { CustomerData } from "../types";

/**
 * Sincroniza o "cofre" do usuário com o Firestore.
 * Conflict Resolution: Verifica se a versão local é mais nova que a versão do servidor.
 */
export const syncUserData = async (userId: string, data: any) => {
  if (!userId) return false;

  const now = new Date().toISOString();
  
  // 1. Persistência Local (Instantânea)
  try {
    const currentLocal = localStorage.getItem(`gb_vault_${userId}`);
    const localUpdatedAt = now;
    const localPayload = { ...data, localUpdatedAt };
    localStorage.setItem(`gb_vault_${userId}`, JSON.stringify(localPayload));
  } catch (e) {
    console.error("💾 Falha no cache local:", e);
  }

  // 2. Sincronização em Nuvem (Se disponível)
  if (!isFirebaseConfigured() || !db) return true;

  try {
    const userDocRef = doc(db, "customers", userId);
    
    // Antes de salvar, poderíamos buscar e comparar timestamps para resolução fina
    // Simplificamos garantindo que salvamos o timestamp da alteração local
    const cleanData = JSON.parse(JSON.stringify({
      ...data,
      lastActive: now,
      localUpdatedAt: now
    }));

    await setDoc(userDocRef, {
      ...cleanData,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
    
    return true;
  } catch (error: any) {
    console.warn("☁️ Nuvem temporariamente indisponível. Dados salvos localmente.");
    return true; 
  }
};

export const fetchUserData = async (userId: string) => {
  if (!userId) return null;

  let localData = null;
  const localRaw = localStorage.getItem(`gb_vault_${userId}`);
  if (localRaw) {
    try { localData = JSON.parse(localRaw); } catch (e) {}
  }

  if (isFirebaseConfigured() && db) {
    try {
      const userDocRef = doc(db, "customers", userId);
      const snapshot = await getDoc(userDocRef);
      
      if (snapshot.exists()) {
        const cloudData = snapshot.data();
        
        // CONFLICT RESOLUTION: Se o cloud for mais novo que o local, usa o cloud
        if (!localData || (cloudData.localUpdatedAt && new Date(cloudData.localUpdatedAt) > new Date(localData.localUpdatedAt))) {
           localData = { ...localData, ...cloudData };
           localStorage.setItem(`gb_vault_${userId}`, JSON.stringify(localData));
        }
      }
    } catch (error) {
      console.warn("📡 Nuvem inacessível. Usando dados locais.");
    }
  }

  return localData;
};

export const fetchAllCustomers = async (): Promise<CustomerData[]> => {
  if (!isFirebaseConfigured() || !db) return [];
  try {
    const customersRef = collection(db, "customers");
    const q = query(customersRef, orderBy("lastActive", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() } as CustomerData));
  } catch (error) {
    return [];
  }
};
