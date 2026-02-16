
export type TransactionType = 'INCOME' | 'EXPENSE' | 'SAVING';
export type PaymentMethod = 'CASH' | 'PIX' | 'CARD';

export interface Contribution {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  location: string;
  contributions?: Contribution[];
  type?: string;
  deadlineMonths?: number;
  updatedAt?: any;
  createdAt?: any;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  date: string;
  createdAt: any;
  cardId?: string;
  isPaid?: boolean;
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
  dueDay: number;     
  closingDay?: number; 
  updatedAt: any;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: any;
}

export type EventType = 
  | 'ADD_EXPENSE' 
  | 'ADD_INCOME' 
  | 'ADD_TO_GOAL' 
  | 'CREATE_GOAL' 
  | 'UPDATE_LIMIT' 
  | 'CREATE_REMINDER' 
  | 'PAY_REMINDER'
  | 'ADD_CARD'
  | 'UPDATE_CARD'
  | 'DELETE_CARD'
  | 'PAY_CARD'
  | 'DELETE_ITEM'
  | 'ADMIN_UPDATE_USER'
  | 'ADMIN_SEND_BROADCAST'
  | 'ADMIN_UPDATE_CONFIG';

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
}

export interface UserSession {
  uid: string;
  userId: string;
  name: string;
  email: string;
  isLoggedIn: boolean;
  role: 'USER' | 'ADMIN';
  subscriptionStatus: 'ACTIVE' | 'EXPIRED';
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

export type SubscriptionPlan = 'MONTHLY' | 'YEARLY';

export interface CustomerData {
  userId: string;
  userName: string;
  email: string;
  subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  status?: 'active' | 'blocked' | 'deleted';
  role?: 'USER' | 'ADMIN';
  plan: SubscriptionPlan;
  createdAt?: any;
  lastLogin?: any;
  localUpdatedAt?: string;
  subscriptionExpiryDate?: string;
}

export interface Category {
  name: string;
  type: 'INCOME' | 'EXPENSE';
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
