
import { db, auth } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from "firebase/firestore";

/**
 * Envia uma mensagem para o Firestore (Sincronização Total)
 */
export const sendMessageToFirestore = async (uid: string, text: string, sender: 'user' | 'ai', dedupeKey?: string) => {
  const finalUid = uid || auth.currentUser?.uid;
  if (!finalUid) return;
  
  console.log(`GB Chat Service: Enviando mensagem (${sender}): "${text.substring(0, 30)}..."`);
  
  if (dedupeKey) {
    const q = query(
      collection(db, "users", finalUid, "messages"),
      where("dedupeKey", "==", dedupeKey),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      console.log(`GB Chat Service: Mensagem ignorada (dedupeKey duplicado: ${dedupeKey})`);
      return; 
    }
  }

  try {
    await addDoc(collection(db, "users", finalUid, "messages"), {
      text,
      sender,
      timestamp: serverTimestamp(),
      dedupeKey: dedupeKey || null,
      source: 'chat',
      resolved: false
    });
    console.log(`GB Chat Service: Mensagem salva no Firestore com sucesso.`);
  } catch (err) {
    console.error("GB Chat Service: Erro ao salvar mensagem no Firestore:", err);
  }
};
