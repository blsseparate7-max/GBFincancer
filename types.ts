
export type TransactionType = 'INCOME' | 'EXPENSE' | 'SAVING' | 'INVESTMENT';
export type RecurrenceType = 'NONE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type PaymentMethod = 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO' | 'BOLETO' | 'TRANSFERENCIA';

export interface Category {
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface UserAssets {
  hasCar: boolean;
  carValue: number;
  hasHouse: boolean;
  houseValue: number;
  hasSavings: boolean;
  savingsValue: number;
  targets: {
    car: number;
    house: number;
    savings: number;
  };
  surveyCompleted: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  date: string;
  paymentMethod: string;
  isFixed?: boolean;
}

export interface Note {
  id: string;
  content: string;
  timestamp: string;
  category?: string;
}

export interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  category?: string;
  isRecurring: boolean;
  frequency?: RecurrenceType;
  remindersEnabled: boolean;
  lastReminderSent?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date | string;
  transactionRef?: Transaction;
  isWarning?: boolean;
  isSystem?: boolean;
  billRefId?: string; 
  categorySuggestion?: string; 
  tempTransactionId?: string; 
}

export interface CategoryLimit {
  category: string;
  amount: number;
}

export type GoalType = 'carro' | 'casa_entrada' | 'reserva' | 'manual';

export interface SavingGoal {
  id: string;
  name: string;
  tipo: GoalType;
  targetAmount: number;
  currentAmount: number;
  monthlySaving: number; 
  prazoMeses: number;
  nivelEscada: number;
  ativa: boolean;
  createdAt: string;
  concluidaEm?: string;
}

export interface FinancialAlert {
  id: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  message: string;
  timestamp: string;
}

export type SubscriptionPlan = 'FREE_TRIAL' | 'MONTHLY' | 'YEARLY';

export interface UserSession {
  id: string;
  name: string;
  isLoggedIn: boolean;
  plan: SubscriptionPlan;
  subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  role: 'USER' | 'ADMIN';
  expiresAt?: string;
  photoURL?: string;
  password?: string;
}

export interface CustomerData {
  userId: string;
  userName: string;
  plan: SubscriptionPlan;
  subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  transactions: Transaction[];
  goals: SavingGoal[];
  messages: Message[];
  bills: Bill[];
  notes: Note[];
  alerts?: FinancialAlert[];
  lastActive: string;
  categories?: Category[];
  expiresAt?: string;
  budget?: number;
  metaEconomiaMensal?: number;
  categoryLimits?: CategoryLimit[];
  userAssets?: UserAssets;
  localUpdatedAt?: string;
}
