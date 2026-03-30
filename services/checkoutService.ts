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
    // Redireciona para a Kiwify conforme solicitado pelo usuário
    // O checkoutId passado por parâmetro pode ser ignorado se o usuário quer o link fixo j0VhQzs
    const targetCheckoutId = checkoutId || 'j0VhQzs';
    const checkoutUrl = `https://pay.kiwify.com.br/${targetCheckoutId}?uid=${uid}`;
    window.open(checkoutUrl, '_blank');
  } catch (error) {
    alert("Erro ao iniciar checkout. Tente novamente.");
  }
};
