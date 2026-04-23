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
  // 1. Abrir janela imediatamente para evitar bloqueio de popup
  const checkoutWindow = window.open('about:blank', '_blank');

  try {
    // 2. Criar session no Firestore (async)
    const sessionId = await createCheckoutSession(uid, email, plan);
    
    // Redireciona para a Kiwify conforme solicitado pelo usuário
    const targetCheckoutId = checkoutId || 'j0VhQzs';
    
    // 3. Montar a URL com o parâmetro correto para o webhook
    const checkoutUrl = `https://pay.kiwify.com.br/${targetCheckoutId}?uid=${uid}&custom_parameters[session_id]=${sessionId}`;
    
    // 4. Redirecionar a janela aberta ou usar fallback
    if (checkoutWindow) {
      checkoutWindow.location.href = checkoutUrl;
    } else {
      // Fallback para mobile/navegadores restritos ou se o pop-up foi bloqueado
      window.location.href = checkoutUrl;
    }
  } catch (error) {
    console.error("GB Checkout error:", error);
    if (checkoutWindow) checkoutWindow.close();
    alert("Erro ao iniciar checkout. Tente novamente.");
  }
};
