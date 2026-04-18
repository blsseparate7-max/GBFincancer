
import { syncUserData } from "./databaseService";
import { OnboardingStatus, IncomeProfile, Bill, SavingGoal } from "../types";
import { dispatchEvent } from "./eventDispatcher";
import { sendMessageToFirestore } from "./chatService";

/**
 * Serviço de Gerenciamento do Onboarding GBFinancer
 * Centraliza a lógica de transição entre os 6 passos originais.
 */

export const ONBOARDING_STEPS = {
  WELCOME: 0,
  INCOME: 1,      // Wizard Parte 1
  BILLS: 2,       // Wizard Parte 2
  CHAT_CONFIRM: 3,// Chat Contextual
  GOALS: 4,       // Wizard Parte 3
  INSIGHTS: 5,    // Wizard Parte 4 (Finalização)
  COMPLETED: 6    // Concluído
};

export const updateOnboardingStep = async (uid: string, step: number, currentStatus: OnboardingStatus) => {
  if (!uid) return;
  
  const newStatus = {
    ...currentStatus,
    step,
    completed: step === ONBOARDING_STEPS.COMPLETED
  };

  await syncUserData(uid, {
    onboardingStatus: newStatus as any,
    onboardingSeen: step === ONBOARDING_STEPS.COMPLETED
  });

  return newStatus;
};

export const saveWizardPhase1 = async (uid: string, data: { incomeProfile: IncomeProfile, bills: Bill[] }) => {
  // 1. Salvar Perfil de Renda
  await syncUserData(uid, { incomeProfile: data.incomeProfile });

  // 2. Criar Carteiras mencionadas nas fontes de renda se não existirem
  // E criar Lembretes de Recebimento
  for (const source of data.incomeProfile.sources) {
    if (source.targetWalletName) {
      await dispatchEvent(uid, {
        type: 'CREATE_WALLET',
        payload: { 
          name: source.targetWalletName, 
          balance: 0, 
          type: 'CONTA' 
        },
        source: 'onboarding',
        createdAt: new Date()
      });
    }

    // Criar Lembrete de Recebimento
    await dispatchEvent(uid, {
      type: 'CREATE_REMINDER',
      payload: {
        description: source.description || 'Recebimento',
        amount: source.amountExpected || 0,
        dueDay: source.dates[0] || 1,
        type: 'RECEIVE',
        recurring: true,
        targetWalletName: source.targetWalletName || 'Carteira Principal'
      },
      source: 'onboarding',
      createdAt: new Date()
    });
  }

  // 3. Salvar Gastos Fixos
  for (const bill of data.bills) {
    await dispatchEvent(uid, {
      type: 'CREATE_REMINDER',
      payload: {
        ...bill,
        isPaid: false
      },
      source: 'onboarding',
      createdAt: new Date()
    });
  }

  // 4. Mover para Passo 3 (Chat)
  return await updateOnboardingStep(uid, ONBOARDING_STEPS.CHAT_CONFIRM, { step: ONBOARDING_STEPS.BILLS, completed: false });
};

export const finalizeOnboarding = async (uid: string, data: { goals: any[], spendingLimit?: number }, currentStatus: OnboardingStatus) => {
  // 0. Salvar Limite de Gastos se informado
  if (data.spendingLimit !== undefined) {
    await syncUserData(uid, { spendingLimit: data.spendingLimit });
  }

  // 1. Salvar Metas
  if (data.goals && data.goals.length > 0) {
    await syncUserData(uid, { suggestedGoals: data.goals });
    for (const goal of data.goals) {
      await dispatchEvent(uid, {
        type: 'CREATE_GOAL',
        payload: goal,
        source: 'onboarding',
        createdAt: new Date()
      });
    }
  }

  // 2. Marcar como Concluído
  const finalStatus = await updateOnboardingStep(uid, ONBOARDING_STEPS.COMPLETED, currentStatus);

  // 3. Mensagem de Boas-vindas
  await sendMessageToFirestore(
    uid, 
    "Bem-vindo ao GBFinancer! Agora vamos cuidar do seu dinheiro com inteligência. 🚀", 
    'ai', 
    `welcome-${uid}`
  );

  return finalStatus;
};
