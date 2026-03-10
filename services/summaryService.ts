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
    .filter(t => t.type === 'EXPENSE')
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

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};
