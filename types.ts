

export type TransactionType = 'INCOME' | 'EXPENSE' | 'SAVING';
export type PaymentMethod = 'PIX' | 'DEBIT' | 'CREDIT' | 'CASH' | 'TRANSFER' | 'CARD';

export interface Contribution {
  id: string;
  date: string;
  amount: number;
  note?: string;
  sourceWalletId?: string;
}

export interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  location: string;
  category?: 'Viagem' | 'Carro' | 'Casa' | 'Reserva' | 'Educação' | 'Lazer' | 'Outros';
  priority?: 'Baixa' | 'Média' | 'Alta';
  icon?: string;
  contributions?: Contribution[];
  type?: string;
  level?: number;
  deadlineMonths?: number;
  updatedAt?: any;
  createdAt?: any;
  status?: 'active' | 'completed' | 'canceled';
  resolved?: boolean;
  lastPromptedAt?: any;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  categoryId?: string;
  categoryName?: string;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  date: string;
  createdAt: any;
  cardId?: string;
  walletId?: string;
  walletName?: string;
  sourceWalletId?: string;
  targetWalletId?: string;
  isPaid?: boolean;
  invoiceCycle?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  originalAmount?: number;
  source?: 'chat' | 'ui' | 'admin' | 'system';
  confirmedBy?: string;
  cycleKey?: string;
  status?: 'confirmed' | 'pending' | 'canceled';
  resolved?: boolean;
}

export interface CategoryLimit {
  id: string;
  category: string;
  limit: number;
  spent: number;
  isActive: boolean;
  notified80Month?: string;
  notified100Month?: string;
  updatedAt: any;
}

export interface CreditCardInfo {
  id: string;
  name: string;
  bank: string;
  limit: number;      
  usedAmount: number;  
  availableAmount: number; 
  invoiceAmount: number; // Valor da fatura atual
  dueDay: number;     
  closingDay: number; 
  updatedAt: any;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: any;
  dedupeKey?: string;
  resolved?: boolean;
  actionType?: string;
  actionPayload?: any;
  lastPromptedAt?: any;
}

export type EventType = 
  | 'ADD_EXPENSE' 
  | 'ADD_INCOME' 
  | 'ADD_TO_GOAL' 
  | 'UPDATE_TRANSACTION'
  | 'CREATE_GOAL' 
  | 'UPDATE_GOAL'
  | 'DELETE_GOAL'
  | 'SPEND_FROM_GOAL'
  | 'UPDATE_LIMIT' 
  | 'UPDATE_USER'
  | 'CREATE_REMINDER' 
  | 'PAY_REMINDER'
  | 'DELETE_REMINDER'
  | 'ADD_CARD'
  | 'ADD_CARD_CHARGE'
  | 'UPDATE_CARD'
  | 'DELETE_CARD'
  | 'PAY_CARD'
  | 'DELETE_ITEM'
  | 'ADMIN_UPDATE_USER'
  | 'ADMIN_DELETE_USER'
  | 'ADMIN_SEND_BROADCAST'
  | 'ADMIN_UPDATE_CONFIG'
  | 'CREATE_WALLET'
  | 'UPDATE_WALLET'
  | 'DELETE_WALLET'
  | 'TRANSFER_WALLET'
  | 'CREATE_CATEGORY'
  | 'UPDATE_CATEGORY'
  | 'DELETE_CATEGORY'
  | 'MOVE_TRANSACTION_CATEGORY'
  | 'CREATE_DEBT'
  | 'UPDATE_DEBT'
  | 'DELETE_DEBT'
  | 'REGISTER_DEBT_PAYMENT';

export interface FinanceEvent {
  type: EventType;
  payload: any;
  source: 'chat' | 'ui' | 'admin';
  createdAt: any;
}

export interface Notification {
  id: string;
  type: 'LIMIT_80' | 'LIMIT_100' | 'CC_80' | 'CC_100' | 'BILL_REMINDER' | 'GOAL_SUCCESS' | 'SYSTEM' | 'ADMIN_BROADCAST';
  title: string;
  body: string;
  createdAt: any;
  readAt?: any;
}

export interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  dueDay: number;
  isPaid: boolean;
  paidAt?: string;
  monthKey: string;
  recurring: boolean;
  category?: string;
  cardId?: string;   
  isActive?: boolean; 
  originalBillId?: string;
  type?: 'PAY' | 'RECEIVE';
  cycleKey?: string;
  lastPromptedAt?: any;
  resolved?: boolean;
  dedupeKey?: string;
  status?: 'pending' | 'paid' | 'received' | 'canceled';
}

export type IncomeFrequency = 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' | 'DAILY' | 'VARIABLE';
export type IncomeSourceType = 'SALARY' | 'VALE' | 'COMMISSION' | 'PRO_LABORE' | 'PIX_SALES' | 'DAILY' | 'OTHER';
export type OccupationType = 'CLT' | 'ENTREPRENEUR' | 'AUTONOMOUS' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'OTHER';

export interface IncomeSource {
  id: string;
  type: IncomeSourceType;
  frequency: IncomeFrequency;
  dates: number[]; // Dias do mês (1-31) ou dias da semana (0-6)
  amountExpected?: number;
  description: string;
  targetWalletName?: string;
}

export interface IncomeProfile {
  occupationType: OccupationType;
  sources: IncomeSource[];
  totalExpectedMonthly?: number;
}

export interface UserOnboarding {
  chat?: boolean;
  dash?: boolean;
  goals?: boolean;
  cc?: boolean;
  reminders?: boolean;
  wallets?: boolean;
  insights?: boolean;
  score?: boolean;
  stress?: boolean;
  messages?: boolean;
  resumo?: boolean;
  extrato?: boolean;
  categories?: boolean;
  [key: string]: boolean | undefined;
}

export type SubscriptionStatus = 'trial' | 'active' | 'inactive';
export type SubscriptionPlan = 'mensal' | 'anual';

export interface UserSession {
  uid: string;
  userId: string;
  name: string;
  email: string;
  isLoggedIn: boolean;
  role: 'user' | 'admin';
  subscriptionStatus: SubscriptionStatus;
  plan?: SubscriptionPlan;
  trialEndsAt?: any;
  subscriptionEndsAt?: any;
  paymentProvider?: 'kiwify';
  onboardingSeen?: boolean;
  lgpdAccepted?: boolean;
  lgpdAcceptedAt?: any;
  lgpdVersion?: string;
  incomeProfile?: IncomeProfile;
  defaultReceivingWallet?: string;
  spendingLimit?: number;
  suggestedGoals?: any[];
  status?: 'active' | 'blocked' | 'deleted';
  lastLogin?: any;
  createdAt?: any;
  id?: string;
  password?: string;
  photoURL?: string;
}

export interface AdminConfig {
  defaultAportePercent: number;
  maintenanceMode: boolean;
  updatedAt: any;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetUserId?: string;
  details: string;
  createdAt: any;
}

export interface CustomerData {
  userId: string;
  userName: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  status?: 'active' | 'blocked' | 'deleted';
  role?: 'user' | 'admin';
  plan: SubscriptionPlan;
  trialEndsAt?: any;
  subscriptionEndsAt?: any;
  paymentProvider?: 'kiwify';
  onboardingSeen?: boolean;
  lgpdAccepted?: boolean;
  lgpdAcceptedAt?: any;
  lgpdVersion?: string;
  incomeProfile?: IncomeProfile;
  defaultReceivingWallet?: string;
  spendingLimit?: number;
  suggestedGoals?: any[];
  createdAt?: any;
  lastLogin?: any;
  localUpdatedAt?: string;
}

export interface UserCategory {
  id: string;
  name: string;
  icon: string;
  color?: string;
  type: 'INCOME' | 'EXPENSE';
  createdAt: any;
  updatedAt: any;
}

export interface Note {
  id: string;
  content: string;
  category?: string;
  timestamp: any;
}

export interface SystemMessage {
  id: string;
  text: string;
  type: 'ALERTA' | 'META';
  timestamp: any;
}

export interface WeeklySummary {
  startDate: string;
  endDate: string;
  income: number;
  expense: number;
  balance: number;
  topCategories: { category: string; amount: number }[];
  generatedAt: string;
}

export interface MonthlySummary {
  month: number;
  year: number;
  income: number;
  expense: number;
  balance: number;
  categories: { category: string; amount: number; percentage: number }[];
  generatedAt: string;
}

export type WalletType = 'CONTA' | 'CARTEIRA' | 'POUPANÇA' | 'INVESTIMENTO' | 'OUTRO';

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  balance: number;
  color?: string;
  icon?: string;
  note?: string;
  isActive?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface WalletTransfer {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: any;
}

export type DebtType = 'CARTAO_CREDITO' | 'EMPRESTIMO' | 'CHEQUE_ESPECIAL' | 'FINANCIAMENTO' | 'DIVIDA_INFORMAL' | 'OUTRO';
export type DebtStatus = 'ATIVA' | 'EM_PAGAMENTO' | 'EM_ESPERA' | 'QUITADA';

export interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  installmentAmount: number;
  interestRate?: number;
  remainingInstallments?: number;
  type: DebtType;
  status: DebtStatus;
  observation?: string;
  strategy?: 'SNOWBALL' | 'AVALANCHE';
  createdAt: any;
  updatedAt: any;
}

export type DebtPayment = {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  createdAt: any;
}

export type SupportStatus = 'ai_active' | 'waiting_admin' | 'admin_active' | 'closed';

export interface SupportThread {
  id: string;
  userId: string | null;
  visitorId: string | null;
  userName: string;
  userEmail: string;
  status: SupportStatus;
  lastMessage: string;
  lastSender: 'user' | 'admin' | 'ai';
  unreadByAdmin: boolean;
  unreadByUser: boolean;
  source?: string;
  createdAt: any;
  updatedAt: any;
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderRole: 'user' | 'admin' | 'ai';
  text: string;
  createdAt: any;
}
