import { Transaction, WeeklySummary } from '../types';

export const calculateWeeklySummary = (transactions: Transaction[]): WeeklySummary => {
  const now = new Date();
  // Vamos considerar os últimos 7 dias como "esta semana" para o resumo
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const weekTransactions = transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate >= sevenDaysAgo && tDate <= now;
  });

  const income = weekTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const expense = weekTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const balance = income - expense;

  // Agrupar por categorias (apenas despesas)
  const categoryMap: Record<string, number> = {};
  weekTransactions
    .filter(t => t.type === 'EXPENSE')
    .forEach(t => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + (Number(t.amount) || 0);
    });

  const topCategories = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return {
    startDate: sevenDaysAgo.toISOString(),
    endDate: now.toISOString(),
    income,
    expense,
    balance,
    topCategories,
    generatedAt: now.toISOString()
  };
};

export const calculateMonthlySummary = (transactions: Transaction[]) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTransactions = transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  });

  const income = monthTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const expense = monthTransactions
    .filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const balance = income - expense;

  const categoryMap: Record<string, number> = {};
  monthTransactions
    .filter(t => t.type === 'EXPENSE')
    .forEach(t => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + (Number(t.amount) || 0);
    });

  const categories = Object.entries(categoryMap)
    .map(([category, amount]) => ({ 
      category, 
      amount, 
      percentage: expense > 0 ? (amount / expense) * 100 : 0 
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    month: currentMonth,
    year: currentYear,
    income,
    expense,
    balance,
    categories,
    generatedAt: now.toISOString()
  };
};

export const calculateForecast = (transactions: Transaction[], reminders: any[], wallets: any[]) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const remainingDays = daysInMonth - now.getDate();

  // Saldo Atual
  const currentBalance = wallets
    .filter(w => w.isActive !== false)
    .reduce((sum, w) => sum + (Number(w.balance) || 0), 0);

  // Gastos do mês até agora
  const monthExpenses = transactions
    .filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.type === 'EXPENSE';
    })
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Média diária de gastos (baseado nos dias que já passaram)
  const daysPassed = now.getDate();
  const dailyAverage = monthExpenses / (daysPassed || 1);

  // Contas pendentes até o fim do mês
  const pendingBills = reminders
    .filter(r => !r.isPaid && r.type === 'PAY')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // Recebimentos pendentes até o fim do mês
  const pendingIncome = reminders
    .filter(r => !r.isPaid && r.type === 'RECEIVE')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // Previsão: Saldo Atual + Recebimentos Pendentes - Contas Pendentes - (Média Diária * Dias Restantes)
  const estimatedExpenses = dailyAverage * remainingDays;
  const forecast = currentBalance + pendingIncome - pendingBills - estimatedExpenses;

  return {
    currentBalance,
    monthExpenses,
    dailyAverage,
    pendingBills,
    pendingIncome,
    estimatedExpenses,
    forecast,
    isRisk: forecast < 0
  };
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};
