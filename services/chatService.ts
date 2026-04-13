
import { db, auth } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from "firebase/firestore";

/**
 * Envia uma mensagem para o Firestore (Sincronização Total)
 */
export const sendMessageToFirestore = async (uid: string, text: string, sender: 'user' | 'ai', dedupeKey?: string, actionType?: string, actionPayload?: any) => {
  const finalUid = uid || auth.currentUser?.uid;
  if (!finalUid) {
    console.error("GB Chat Service: UID não encontrado para envio de mensagem.");
    return;
  }
  
  console.log(`GB Chat Service: Iniciando envio de mensagem (${sender}) para users/${finalUid}/chat_messages...`);
  
  if (dedupeKey) {
    try {
      console.log(`[chat] verificando dedupeKey: ${dedupeKey}`);
      const q = query(
        collection(db, "users", finalUid, "chat_messages"),
        where("dedupeKey", "==", dedupeKey),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        console.log(`[chat] mensagem ignorada (dedupeKey duplicado: ${dedupeKey})`);
        return; 
      }
    } catch (err) {
      console.error("[chat] erro ao verificar dedupeKey:", err);
    }
  }

  try {
    console.log(`[chat] salvando mensagem no Firestore (${sender})...`);
    const docRef = await addDoc(collection(db, "users", finalUid, "chat_messages"), {
      text,
      sender,
      createdAt: serverTimestamp(),
      dedupeKey: dedupeKey || null,
      source: 'chat',
      resolved: false,
      actionType: actionType || null,
      actionPayload: actionPayload || null
    });
    console.log(`[chat] mensagem salva com sucesso! ID: ${docRef.id}`);
  } catch (err) {
    console.error("[chat] erro capturado ao salvar no Firestore:", err);
    throw err; // Repassa o erro para que o chamador saiba que falhou
  }
};
