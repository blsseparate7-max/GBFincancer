
export type TransactionType = 'INCOME' | 'EXPENSE' | 'SAVING';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  date: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  transactionRef?: Transaction;
  isWarning?: boolean;
  isSystem?: boolean;
}

export interface CategoryLimit {
  category: string;
  amount: number;
}

export interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlySaving: number;
  deadline?: string;
  advice?: string;
  createdAt: string;
}

export type SubscriptionPlan = 'FREE_TRIAL' | 'MONTHLY' | 'YEARLY';

export interface UserSession {
  id: string;
  name: string;
  isLoggedIn: boolean;
  plan: SubscriptionPlan;
  subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  role: 'USER' | 'ADMIN';
}

export interface CustomerData {
  userId: string;
  userName: string;
  plan: SubscriptionPlan;
  transactions: Transaction[];
  goals: SavingGoal[];
  lastActive: string;
}
