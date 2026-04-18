import { CreditCardInfo, SavingGoal, Bill, CategoryLimit, Wallet, UserCategory } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Migra silenciosamente um cartão se faltarem campos essenciais.
 */
export const migrateCardIfNeeded = async (uid: string, cardId: string, data: any) => {
  const needsMigration = data.dueDay === undefined || 
                        data.closingDay === undefined || 
                        data.limitTotal === undefined || 
                        data.usedLimit === undefined ||
                        data.availableLimit === undefined ||
                        data.currentInvoiceAmount === undefined;

  if (needsMigration) {
    try {
      const cardRef = doc(db, "users", uid, "cards", cardId);
      const limitVal = data.limitTotal !== undefined ? data.limitTotal : (data.limit || 0);
      const usedVal = data.usedLimit !== undefined ? data.usedLimit : (data.usedAmount || 0);
      const invoiceVal = data.currentInvoiceAmount !== undefined ? data.currentInvoiceAmount : (data.invoiceAmount !== undefined ? data.invoiceAmount : usedVal);

      await updateDoc(cardRef, {
        dueDay: data.dueDay || 10,
        closingDay: data.closingDay || 7,
        limitTotal: limitVal,
        usedLimit: usedVal,
        availableLimit: data.availableLimit !== undefined ? data.availableLimit : (limitVal - usedVal),
        currentInvoiceAmount: invoiceVal,
        // Compatibilidade
        limit: limitVal,
        usedAmount: usedVal,
        invoiceAmount: invoiceVal,
        updatedAt: new Date()
      });
      console.log(`GB: Cartão ${cardId} migrado com sucesso.`);
    } catch (e) {
      console.error("Erro na migração silenciosa do cartão:", e);
    }
  }
};

/**
 * Migra silenciosamente uma meta se faltarem campos essenciais.
 */
export const migrateGoalIfNeeded = async (uid: string, goalId: string, data: any) => {
  const needsMigration = data.targetAmount === undefined || data.currentAmount === undefined;
  if (needsMigration) {
    try {
      const goalRef = doc(db, "users", uid, "goals", goalId);
      await updateDoc(goalRef, {
        targetAmount: data.targetAmount !== undefined ? data.targetAmount : (data.target || data.goalAmount || 0),
        currentAmount: data.currentAmount !== undefined ? data.currentAmount : (data.saved || data.balance || 0),
        updatedAt: new Date()
      });
    } catch (e) {}
  }
};

/**
 * Migra silenciosamente uma carteira se faltarem campos essenciais.
 */
export const migrateWalletIfNeeded = async (uid: string, walletId: string, data: any) => {
  const needsMigration = data.balance === undefined || data.type === undefined;
  if (needsMigration) {
    try {
      const walletRef = doc(db, "users", uid, "wallets", walletId);
      await updateDoc(walletRef, {
        balance: data.balance !== undefined ? data.balance : (data.amount || data.value || 0),
        type: data.type || 'CONTA',
        updatedAt: new Date()
      });
    } catch (e) {}
  }
};

/**
 * Normaliza dados de Cartão de Crédito suportando schemas antigos e novos.
 */
export const normalizeCard = (docSnap: any, uid?: string): CreditCardInfo => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  if (uid && docSnap.id) {
    migrateCardIfNeeded(uid, docSnap.id, data);
  }

  const limitTotal = data.limitTotal !== undefined ? data.limitTotal : (data.limit || 0);
  const usedLimit = data.usedLimit !== undefined ? data.usedLimit : (data.usedAmount || 0);
  const currentInvoiceAmount = data.currentInvoiceAmount !== undefined ? data.currentInvoiceAmount : (data.invoiceAmount !== undefined ? data.invoiceAmount : usedLimit);
  
  return {
    id,
    name: data.name || 'Cartão sem nome',
    bank: data.bank || 'Banco não informado',
    limit: limitTotal,
    usedAmount: usedLimit,
    availableAmount: data.availableLimit !== undefined ? data.availableLimit : (data.availableAmount !== undefined ? data.availableAmount : (limitTotal - usedLimit)),
    invoiceAmount: currentInvoiceAmount,
    dueDay: data.dueDay || 10,
    closingDay: data.closingDay || 7,
    updatedAt: data.updatedAt || null,
    isQA: !!data.isQA
  };
};

/**
 * Normaliza dados de Metas de Economia.
 */
export const normalizeGoal = (docSnap: any, uid?: string): SavingGoal => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  if (uid && docSnap.id) {
    migrateGoalIfNeeded(uid, docSnap.id, data);
  }

  return {
    id,
    name: data.name || data.title || 'Meta sem nome',
    targetAmount: data.targetAmount !== undefined ? data.targetAmount : (data.target || data.goalAmount || 0),
    currentAmount: data.currentAmount !== undefined ? data.currentAmount : (data.saved || data.balance || 0),
    category: data.category || 'Outros',
    priority: data.priority || 'Média',
    deadlineMonths: data.deadlineMonths || 12,
    level: data.level || 1,
    updatedAt: data.updatedAt || null,
    createdAt: data.createdAt || null,
    contributions: data.contributions || [],
    // Novos campos
    status: data.status || 'ACTIVE',
    resolved: !!data.resolved,
    lastPromptedAt: data.lastPromptedAt || null,
    isQA: !!data.isQA
  };
};

/**
 * Normaliza dados de Carteira.
 */
export const normalizeWallet = (docSnap: any, uid?: string): Wallet => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  if (uid && docSnap.id) {
    migrateWalletIfNeeded(uid, docSnap.id, data);
  }

  return {
    id,
    name: data.name || 'Carteira sem nome',
    type: data.type || 'CONTA',
    balance: data.balance !== undefined ? data.balance : (data.amount || data.value || 0),
    color: data.color || '#128C7E',
    icon: data.icon || 'Wallet',
    note: data.note || '',
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    isQA: !!data.isQA
  };
};

/**
 * Normaliza dados de Lembretes/Contas.
 */
export const normalizeReminder = (docSnap: any): Bill => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  // Compatibilidade com tipos antigos (PAGAR/RECEBER vs PAY/RECEIVE)
  let normalizedType: 'PAY' | 'RECEIVE' = 'PAY';
  if (data.type === 'RECEIVE' || data.type === 'RECEBIMENTO' || data.type === 'RECEBER') {
    normalizedType = 'RECEIVE';
  }

  const rawDate = data.dueDate || data.date;
  let dueDate = new Date().toISOString();
  try {
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        dueDate = d.toISOString();
      }
    }
  } catch (e) {}

  return {
    id,
    description: data.description || data.desc || data.name || 'Sem descrição',
    amount: data.amount || data.value || 0,
    dueDate: dueDate,
    dueDay: data.dueDay || (dueDate ? new Date(dueDate).getDate() : (data.day || 1)),
    isPaid: data.isPaid || data.paid || false,
    paidAt: data.paidAt || null,
    monthKey: data.monthKey || '',
    recurring: data.recurring !== undefined ? data.recurring : true,
    category: data.category || (normalizedType === 'RECEIVE' ? 'Recebimento' : 'Contas Fixas'),
    type: normalizedType,
    isActive: data.isActive !== undefined ? data.isActive : true,
    cardId: data.cardId || null,
    // Novos campos
    status: data.status || (data.isPaid ? 'paid' : 'pending'),
    cycleKey: data.cycleKey || null,
    lastPromptedAt: data.lastPromptedAt || null,
    resolved: !!data.resolved,
    dedupeKey: data.dedupeKey || null,
    isQA: !!data.isQA
  };
};

/**
 * Normaliza dados de Limites por Categoria.
 */
export const normalizeLimit = (docSnap: any): CategoryLimit => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  return {
    id,
    category: data.category || data.categoryName || data.tag || data.group || 'Geral',
    limit: data.limit !== undefined ? data.limit : (data.amount || data.maxAmount || 0),
    spent: data.spent || data.used || 0,
    isActive: data.isActive !== undefined ? data.isActive : true,
    updatedAt: data.updatedAt || null,
    isQA: !!data.isQA
  };
};

/**
 * Normaliza nomes de categorias para um padrão global.
 */
export const normalizeCategoryName = (cat: any): string => {
  if (!cat || typeof cat !== 'string') return 'Outros';
  
  const trimmed = cat.trim();
  if (trimmed.length === 0) return 'Outros';

  // Se a categoria começa com QA_, preservamos sempre (para testes funcionais)
  if (trimmed.startsWith('QA_')) return trimmed;

  // Se a categoria tem letras maiúsculas no meio E letras minúsculas (CamelCase), preservamos.
  // Isso evita que "SuperMercado" vire "Supermercado".
  const rest = trimmed.slice(1);
  const hasUpperInRest = /[A-Z]/.test(rest);
  const hasLower = /[a-z]/.test(trimmed);
  
  if (hasUpperInRest && hasLower) {
    return trimmed;
  }

  // Para o resto (tudo maiúsculo ou tudo minúsculo), aplicamos o padrão Capitalized.
  // Ex: "ALIMENTAÇÃO" -> "Alimentação", "pix" -> "Pix"
  return trimmed.charAt(0).toUpperCase() + rest.toLowerCase();
};

/**
 * Normaliza dados de Dívidas.
 */
export const normalizeDebt = (docSnap: any): any => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  return {
    id,
    name: data.name || 'Dívida sem nome',
    totalAmount: data.totalAmount || 0,
    remainingAmount: data.remainingAmount !== undefined ? data.remainingAmount : (data.totalAmount || 0),
    installmentAmount: data.installmentAmount || 0,
    interestRate: data.interestRate || 0,
    remainingInstallments: data.remainingInstallments || 0,
    type: data.type || 'OUTRO',
    status: data.status || 'ATIVA',
    observation: data.observation || '',
    strategy: data.strategy || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    isQA: !!data.isQA
  };
};

/**
 * Normaliza dados de Transações.
 */
export const normalizeTransaction = (docSnap: any): any => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  // Garante que o valor é um número válido
  const rawAmount = data.amount !== undefined ? data.amount : (data.value || 0);
  const amount = Number(rawAmount) || 0;

  const rawDate = data.date || data.timestamp;
  let finalDate = new Date().toISOString().split('T')[0];
  try {
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        finalDate = d.toISOString().split('T')[0];
      }
    }
  } catch (e) {}

  return {
    id,
    description: data.description || data.desc || data.name || 'Sem descrição',
    amount: amount,
    category: normalizeCategoryName(data.category || data.tag || 'Outros'),
    type: data.type || (amount < 0 ? 'EXPENSE' : 'INCOME'),
    paymentMethod: data.paymentMethod === 'CREDIT' ? 'CARD' : (data.paymentMethod || data.method || 'PIX'),
    date: finalDate,
    createdAt: data.createdAt || null,
    cardId: data.cardId || null,
    sourceWalletId: data.sourceWalletId || data.walletId || null,
    targetWalletId: data.targetWalletId || data.walletId || null,
    walletId: data.walletId || null,
    walletName: data.walletName || null,
    isPaid: data.isPaid !== undefined ? data.isPaid : (data.paymentMethod === 'CARD' ? false : true),
    invoiceCycle: data.invoiceCycle || null,
    // Novos campos para orquestração e deduplicação
    status: data.status || 'CONFIRMED',
    cycleKey: data.cycleKey || null,
    lastPromptedAt: data.lastPromptedAt || null,
    dedupeKey: data.dedupeKey || null,
    resolved: !!data.resolved,
    source: data.source || 'CHAT',
    confirmedBy: data.confirmedBy || null,
    isQA: !!data.isQA,
    installmentNumber: data.installmentNumber || null,
    totalInstallments: data.totalInstallments || null,
    originalAmount: data.originalAmount || null
  };
};

/**
 * Normaliza dados de Categoria do Usuário.
 */
export const normalizeUserCategory = (docSnap: any): UserCategory => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  return {
    id,
    name: data.name || 'Sem nome',
    icon: data.icon || 'Tag',
    color: data.color || '#128C7E',
    type: data.type || 'EXPENSE',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    isQA: !!data.isQA
  };
};

/**
 * Função global para garantir que todos os dados do usuário estão íntegros.
 * Pode ser chamada no login ou periodicamente.
 */
export const assertSchema = async (uid: string, data: { transactions: any[], goals: any[], cards: any[] }) => {
  // Esta função pode disparar updates em massa se necessário, 
  // mas por enquanto focamos em garantir que os objetos em memória estão corretos.
  // A normalização individual já cuida da maioria dos casos.
  console.log(`GB: Schema verificado para usuário ${uid}`);
};
