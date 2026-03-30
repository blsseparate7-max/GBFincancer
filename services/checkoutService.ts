import { db } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const createCheckoutSession = async (uid: string) => {
  try {
    const sessionRef = await addDoc(collection(db, "checkoutSessions"), {
      uid,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return sessionRef.id;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    throw error;
  }
};

export const handleKiwifyRedirect = async (uid: string, checkoutId: string) => {
  try {
    const sessionId = await createCheckoutSession(uid);
    // Redireciona para a Kiwify passando o session_id como parâmetro customizado
    // A Kiwify permite passar parâmetros na URL que são retornados no webhook
    const checkoutUrl = `https://pay.kiwify.com.br/${checkoutId}?session_id=${sessionId}`;
    window.open(checkoutUrl, '_blank');
  } catch (error) {
    alert("Erro ao iniciar checkout. Tente novamente.");
  }
};
