
export type TransactionType = 'INCOME' | 'EXPENSE' | 'SAVING';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  date: string;
  paymentMethod: string;
}

export type GoalType = 'carro' | 'casa_entrada' | 'reserva' | 'outros';

export interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  ativa?: boolean;
  tipo?: GoalType;
  nivelEscada?: number;
  prazoMeses?: number;
  monthlySaving?: number;
  createdAt?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date | string;
}

export interface UserProfile {
  name: string;
  monthlyBudget: number;
  photoURL?: string;
  onboardingCompleted?: boolean;
  financialProfile?: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
}

export interface AppData {
  transactions: Transaction[];
  goals: SavingGoal[];
  messages: Message[];
  profile: UserProfile;
}

export interface UserAssets {
  hasCar: boolean;
  carValue: number;
  hasHouse: boolean;
  houseValue: number;
  savingsValue: number;
  surveyCompleted: boolean;
  targets: {
    car: number;
    house: number;
  };
}

export type SubscriptionPlan = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'PENDING';
export type UserRole = 'USER' | 'ADMIN';

export interface UserSession {
  id: string;
  name: string;
  isLoggedIn: boolean;
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  role: UserRole;
  password?: string;
  photoURL?: string;
  onboardingCompleted?: boolean;
}

export interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  isRecurring: boolean;
  remindersEnabled: boolean;
  frequency: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
}

export interface Category {
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface Note {
  id: string;
  content: string;
  category?: string;
  timestamp: string | Date;
}

export interface CustomerData {
  userId: string;
  userName: string;
  password?: string;
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  transactions: Transaction[];
  goals: SavingGoal[];
  messages: Message[];
  bills: Bill[];
  notes: Note[];
  lastActive: string;
  onboardingCompleted?: boolean;
  monthlyBudget?: number;
  localUpdatedAt?: string;
  serverUpdatedAt?: any;
}
