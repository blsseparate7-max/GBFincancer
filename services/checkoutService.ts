import { db } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { OAUTH_CONFIG } from '../constants';

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

export const handleAsaasRedirect = async (uid: string, email: string, plan: string = 'mensal', name: string = '', cpfCnpj: string = '') => {
  let checkoutWindow: Window | null = null;
  console.log(`[ASAAS] Iniciando redirect para ${uid} (${plan})...`);
  
  // Only try to open window if we are not in a restricted environment
  try {
    checkoutWindow = window.open('about:blank', '_blank');
    console.log("[ASAAS] Janela de checkout aberta (aguardando URL)");
  } catch (e) {
    console.warn("[ASAAS] Pop-up bloqueado ou não suportado");
  }
  
  try {
    console.log("[ASAAS] Chamando API de checkout...");
    const response = await fetch('/api/checkout/asaas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, email, plan, name, cpfCnpj })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[ASAAS] Erro na resposta do servidor:", errorData);
      throw new Error(errorData.error || 'Erro ao gerar checkout Asaas');
    }

    const data = await response.json();
    const { checkoutUrl } = data;
    console.log(`[ASAAS] Checkout URL recebida: ${checkoutUrl}`);

    if (!checkoutUrl) {
      throw new Error("Link de checkout não recebido do servidor.");
    }

    if (checkoutWindow && !checkoutWindow.closed) {
      console.log("[ASAAS] Redirecionando janela popup...");
      checkoutWindow.location.href = checkoutUrl;
    } else {
      console.log("[ASAAS] Redirecionando janela principal...");
      window.location.href = checkoutUrl;
    }
  } catch (error: any) {
    console.error("[ASAAS] Erro durante o redirecionamento:", error);
    if (checkoutWindow) checkoutWindow.close();
    throw error;
  }
};

/**
 * Helper to handle the subscription flow with Asaas including CPF/CNPJ validation
 * and synchronization with Firestore.
 */
export const subscribeWithAsaas = async (
  user: any, 
  plan: string = 'mensal', 
  onCpfRequested?: () => void
): Promise<void> => {
  const currentCpf = user.cpfCnpj?.replace(/\D/g, '');
  
  if (!currentCpf) {
    if (onCpfRequested) {
      onCpfRequested();
      return;
    } else {
      const cpf = window.prompt("O Asaas exige que você informe seu CPF ou CNPJ para gerar a cobrança segura. Por favor, informe abaixo:");
      if (cpf) {
        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length === 11 || cleanCpf.length === 14) {
          const { syncUserData } = await import('./databaseService');
          await syncUserData(user.uid, { cpfCnpj: cleanCpf });
          return await handleAsaasRedirect(user.uid, user.email, plan, user.name || user.displayName || '', cleanCpf);
        } else {
          alert("CPF ou CNPJ inválido.");
          throw new Error("CPF ou CNPJ inválido.");
        }
      }
      return;
    }
  }

  return await handleAsaasRedirect(user.uid, user.email, plan, user.name || user.displayName || '', currentCpf);
};
