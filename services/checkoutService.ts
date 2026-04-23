import { db } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const createCheckoutSession = async (uid: string, email: string, plan: string = 'mensal') => {
  try {
    const sessionRef = await addDoc(collection(db, "checkoutSessions"), {
      uid,
      email,
      plan,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    console.log(`[CHECKOUT] session criada: ${sessionRef.id} para o usuário ${uid}`);
    return sessionRef.id;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    throw error;
  }
};

export const handleKiwifyRedirect = async (uid: string, checkoutId: string, email: string = '', plan: string = 'mensal') => {
  try {
    // 1. Criar session antes do redirect
    const sessionId = await createCheckoutSession(uid, email, plan);
    console.log(`[CHECKOUT] session_id enviado para Kiwify: ${sessionId}`);

    // Redireciona para a Kiwify conforme solicitado pelo usuário
    const targetCheckoutId = checkoutId || 'j0VhQzs';
    // Enviando sessionId via parâmetro session_id que a Kiwify deve processar e retornar como custom_parameters.session_id
    const checkoutUrl = `https://pay.kiwify.com.br/${targetCheckoutId}?uid=${uid}&session_id=${sessionId}`;
    
    window.open(checkoutUrl, '_blank');
  } catch (error) {
    console.error("GB Checkout error:", error);
    alert("Erro ao iniciar checkout. Tente novamente.");
  }
};
