
import { db, auth } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from "firebase/firestore";

/**
 * Envia uma mensagem para o Firestore (Sincronização Total)
 */
export const sendMessageToFirestore = async (uid: string, text: string, sender: 'user' | 'ai', dedupeKey?: string) => {
  const finalUid = uid || auth.currentUser?.uid;
  if (!finalUid) {
    console.error("GB Chat Service: UID não encontrado para envio de mensagem.");
    return;
  }
  
  console.log(`GB Chat Service: Iniciando envio de mensagem (${sender}) para users/${finalUid}/chat_messages...`);
  
  if (dedupeKey) {
    try {
      const q = query(
        collection(db, "users", finalUid, "chat_messages"),
        where("dedupeKey", "==", dedupeKey),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        console.log(`GB Chat Service: Mensagem ignorada (dedupeKey duplicado: ${dedupeKey})`);
        return; 
      }
    } catch (err) {
      console.error("GB Chat Service: Erro ao verificar dedupeKey:", err);
    }
  }

  try {
    const docRef = await addDoc(collection(db, "users", finalUid, "chat_messages"), {
      text,
      sender,
      createdAt: serverTimestamp(),
      dedupeKey: dedupeKey || null,
      source: 'chat',
      resolved: false
    });
    console.log(`GB Chat Service: Mensagem salva com sucesso! ID: ${docRef.id} em chat_messages`);
  } catch (err) {
    console.error("GB Chat Service: ERRO CRÍTICO ao salvar mensagem no Firestore:", err);
    throw err; // Repassa o erro para que o chamador saiba que falhou
  }
};
