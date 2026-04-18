import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Transaction, SavingGoal, CategoryLimit, Wallet, Bill, UserCategory } from '../types';
import { dispatchEvent, migrateTransactions } from '../services/eventDispatcher';
import { normalizeCategoryName } from '../services/normalizationService';
import OnboardingChecklist from './OnboardingChecklist';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Wallet as WalletIcon, PiggyBank, 
  AlertCircle, Calendar, Lightbulb, ArrowRight, Target,
  ChevronLeft, ChevronRight, Info, DollarSign, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, Sparkles, Loader2, Plus, Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MoneyInput from './MoneyInput';
import { Notification } from './UI';
import { GoogleGenAI } from "@google/genai";
import { sendMessageToFirestore } from '../services/chatService';
import { 
  DailyInsight, 
  MainStats, 
  CashFlowChart, 
  ProjectionCard, 
  ExpenseRanking, 
  GlobalSpendingLimitCard, 
  SpendingLimitsCard, 
  CompositionChart, 
  UpcomingBillsCard,
  SuggestionCard,
  GoalSuggestionCard,
  FinancialHealthHub
} from './DashboardComponents';

interface DashProps {
  transactions: Transaction[];
  goals: SavingGoal[];
  limits: CategoryLimit[];
  wallets: Wallet[];
  reminders: Bill[];
  categories: UserCategory[];
  uid: string;
  user: any; // UserSession
  loading?: boolean;
  onNavigateToExtrato?: (filters: any) => void;
  onNavigateToTab?: (tab: string) => void;
  isExpired?: boolean;
}

const Dashboard: React.FC<DashProps> = ({ transactions, goals, limits, wallets, reminders, categories, uid, user, loading, onNavigateToExtrato, onNavigateToTab, isExpired = false }) => {
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [editingLimit, setEditingLimit] = useState<CategoryLimit | null>(null);
  const [showGlobalLimitModal, setShowGlobalLimitModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFullRanking, setShowFullRanking] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Transaction Form State
  const [txType, setTxType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txCategory, setTxCategory] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txWalletId, setTxWalletId] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const [limitCat, setLimitCat] = useState('');
  const [limitVal, setLimitVal] = useState('');
  const [globalLimitVal, setGlobalLimitVal] = useState(user?.spendingLimit?.toString() || '');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dailyInsight, setDailyInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const isMigratingRef = useRef(false);
  useEffect(() => {
    if (uid && transactions.length > 0 && !isMigratingRef.current) {
      const hasOldData = transactions.some(t => !t.walletName || !t.categoryName);
      if (hasOldData) {
        isMigratingRef.current = true;
        migrateTransactions(uid).finally(() => {
          isMigratingRef.current = false;
        });
      }
    }
  }, [uid, transactions.length]);

  useEffect(() => {
    const fetchInsight = async () => {
      if (transactions.length < 5 || dailyInsight) return;
      setLoadingInsight(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const recentTrans = transactions.slice(0, 10).map(t => `${t.description}: ${t.amount}`).join(', ');
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Você é o Mentor Financeiro GB. Com base nestas transações recentes: ${recentTrans}, dê uma dica financeira curta, direta e motivadora em português. Máximo 150 caracteres.`,
        });
        setDailyInsight(response.text || "Continue focado nos seus objetivos!");
      } catch (err) {
        console.error("Insight Error:", err);
      } finally {
        setLoadingInsight(false);
      }
    };
    fetchInsight();
  }, [transactions, uid]);

  const onboardingSteps = useMemo(() => [
    {
      id: 'first_trans',
      title: 'Primeira Transação',
      description: 'Registre seu primeiro gasto ou ganho no Mentor IA.',
      completed: transactions.length > 0,
      action: () => { window.location.hash = '#chat'; }
    },
    {
      id: 'create_goal',
      title: 'Definir Meta',
      description: 'Crie um objetivo de economia para o futuro.',
      completed: goals.length > 0,
      action: () => { window.location.hash = '#goals'; }
    },
    {
      id: 'set_limit',
      title: 'Teto de Gastos',
      description: 'Defina um limite para uma categoria importante.',
      completed: limits.length > 0,
      action: () => setShowLimitModal(true)
    },
    {
      id: 'add_wallet',
      title: 'Vincular Conta',
      description: 'Adicione suas contas bancárias ou carteiras.',
      completed: wallets.length > 0,
      action: () => { window.location.hash = '#wallets'; }
    }
  ], [transactions.length, goals.length, limits.length, wallets.length]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    // Stats calculation logic...
    const monthTransactions = transactions.filter(t => {
      return t.date && t.date.startsWith(monthKey);
    });

    const income = monthTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    
    // Regra: Não considera gastos de cartão como saída real (apenas o PIX do pagamento da fatura conta)
    const expense = monthTransactions
      .filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD')
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    
    const totalSaved = goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);
    const activeWallets = wallets.filter(w => w.isActive !== false);
    const saldoLivre = activeWallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);

    // Daily Stats for Calendar
    const dailyStats: Record<number, { income: number; expense: number; transactions: Transaction[] }> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      dailyStats[i] = { income: 0, expense: 0, transactions: [] };
    }

    monthTransactions.forEach(t => {
      // Regra: No calendário, apenas saída real (ignora cartão individual)
      if (t.type === 'EXPENSE' && t.paymentMethod === 'CARD') return;

      // t.date is YYYY-MM-DD, we want the DD part
      const dayPart = t.date.split('-')[2];
      const d = parseInt(dayPart);
      if (dailyStats[d]) {
        if (t.type === 'INCOME') dailyStats[d].income += Number(t.amount);
        if (t.type === 'EXPENSE') dailyStats[d].expense += Number(t.amount);
        dailyStats[d].transactions.push(t);
      }
    });

    // Highlights
    let maxIncome = -1;
    let maxIncomeDay = 0;
    let maxExpense = -1;
    let maxExpenseDay = 0;
    let bestBalance = -Infinity;
    let bestDay = 0;
    let worstBalance = Infinity;
    let worstDay = 0;

    Object.entries(dailyStats).forEach(([dayStr, data]) => {
      const day = parseInt(dayStr);
      const balance = data.income - data.expense;

      if (data.income > maxIncome) {
        maxIncome = data.income;
        maxIncomeDay = day;
      }
      if (data.expense > maxExpense) {
        maxExpense = data.expense;
        maxExpenseDay = day;
      }
      if (balance > bestBalance && (data.income > 0 || data.expense > 0)) {
        bestBalance = balance;
        bestDay = day;
      }
      if (balance < worstBalance && (data.income > 0 || data.expense > 0)) {
        worstBalance = balance;
        worstDay = day;
      }
    });

    // Expense Ranking - Agregação robusta por categoria
    const expenseCategories = monthTransactions
      .filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD')
      .reduce((acc, t) => {
        const rawCat = t.category || 'Outros';
        const displayCat = normalizeCategoryName(rawCat);
        const groupKey = displayCat.toLowerCase().trim();
        
        if (!acc[groupKey]) {
          acc[groupKey] = { name: displayCat, value: 0 };
        }
        acc[groupKey].value += Math.abs(Number(t.amount) || 0);
        return acc;
      }, {} as Record<string, { name: string; value: number }>);

    const expenseCategoriesList = Object.values(expenseCategories) as { name: string; value: number }[];
    const totalExpenses: number = expenseCategoriesList.reduce((a, b) => a + b.value, 0);
    
    const expenseRanking = expenseCategoriesList
      .map(item => ({
        name: item.name,
        value: item.value,
        percentage: totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    // Spending Limits - Apenas categorias configuradas manualmente
    const spendingLimits = limits
      .filter(lim => lim.limit && lim.limit > 0)
      .map(lim => {
        const pct = lim.limit > 0 ? (lim.spent / lim.limit) * 100 : 0;
        return { ...lim, pct };
      }).sort((a, b) => b.pct - a.pct);

    const globalLimit = user?.spendingLimit || null;
    const globalSpent = expense; // Total monthly expense

    // Projection
    const dailyAvg = currentDay > 0 ? expense / currentDay : 0;
    const projectedExpense = dailyAvg * daysInMonth;
    const projectedBalance = income - projectedExpense;

    // Suggestion
    let suggestion = null;
    if (expenseRanking.length > 0) {
      const top = expenseRanking[0];
      suggestion = {
        category: top.name,
        percentage: top.percentage.toFixed(0),
        saving: top.value * 0.1
      };
    }

    // Upcoming Bills
    const upcomingBills = reminders
      .filter(b => !b.isPaid && b.type === 'PAY')
      .map(b => {
        const dueDate = new Date(b.dueDate);
        const diff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...b, daysLeft: diff };
      })
      .filter(b => b.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3);

    // Goal Suggestion
    const sobra = income - expense;
    const goalSuggestion = sobra > 500 ? sobra * 0.3 : null;

    // Charts Data
    const barData = [
      { name: 'Entradas', value: income, fill: '#00a884' },
      { name: 'Saídas', value: expense, fill: '#f43f5e' }
    ];

    // Pie Data - Agrupa em "Outros" se houver mais de 6 categorias para manter a legibilidade do gráfico
    const pieData = expenseRanking.length <= 6 
      ? expenseRanking.map(item => ({ name: item.name, value: item.value }))
      : [
          ...expenseRanking.slice(0, 5).map(item => ({ name: item.name, value: item.value })),
          { 
            name: 'Outros', 
            value: expenseRanking.slice(5).reduce((sum, item) => sum + item.value, 0) 
          }
        ];

    const COLORS = ['#00a884', '#d4af37', '#005c4b', '#f43f5e', '#8b5cf6'];

    const txCount = transactions.length;
    const goalsCount = goals.filter(g => g.currentAmount >= g.targetAmount).length;
    const xp = (txCount * 10) + (goalsCount * 100);
    const level = Math.floor(Math.sqrt(xp / 50)) + 1;
    const nextLevelXp = Math.pow(level, 2) * 50;
    const currentLevelXp = Math.pow(level - 1, 2) * 50;
    const progress = ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
    
    const userLevel = { level, xp, progress, nextLevelXp };

    return { 
      monthKey,
      income, expense, saldoLivre, totalSaved, expenseRanking, spendingLimits, 
      projectedBalance, suggestion, upcomingBills, goalSuggestion, barData, pieData, COLORS,
      dailyStats, daysInMonth, firstDayOfMonth, currentMonth, currentYear,
      highlights: { maxIncomeDay, maxExpenseDay, bestDay, worstDay, maxIncome, maxExpense },
      userLevel, globalLimit, globalSpent
    };
  }, [transactions, goals, limits, wallets, reminders]);

  // Alert Manager (Chat & Visual)
  useEffect(() => {
    if (!uid || isExpired) return;

    const checkLimits = async () => {
      const { globalLimit, globalSpent, spendingLimits, monthKey } = stats;

      // 1. Global Limit Alerts
      if (globalLimit && globalLimit > 0) {
        const pct = (globalSpent / globalLimit) * 100;
        
        if (pct >= 100) {
          await sendMessageToFirestore(
            uid,
            `🚨 ALERTA: Você ultrapassou seu limite de gastos global de ${format(globalLimit)}! Total gasto: ${format(globalSpent)}.`,
            'ai',
            `limit-global-100-${uid}-${monthKey}`
          );
        } else if (pct >= 80) {
          await sendMessageToFirestore(
            uid,
            `⚠️ ATENÇÃO: Você atingiu ${pct.toFixed(0)}% do seu limite global (${format(globalSpent)} de ${format(globalLimit)}).`,
            'ai',
            `limit-global-80-${uid}-${monthKey}`
          );
        }
      }

      // 2. Category Limit Alerts
      for (const lim of spendingLimits) {
        if (lim.pct >= 100) {
          await sendMessageToFirestore(
            uid,
            `🚩 LIMITE ATINGIDO: A categoria "${lim.category}" ultrapassou o teto de ${format(lim.limit)}. Gasto atual: ${format(lim.spent)}.`,
            'ai',
            `limit-cat-100-${uid}-${lim.id}-${monthKey}`
          );
        } else if (lim.pct >= 80) {
          await sendMessageToFirestore(
            uid,
            `⏳ QUASE LÁ: A categoria "${lim.category}" atingiu ${lim.pct.toFixed(0)}% do limite planejado (${format(lim.spent)} de ${format(lim.limit)}).`,
            'ai',
            `limit-cat-80-${uid}-${lim.id}-${monthKey}`
          );
        }
      }
    };

    const timer = setTimeout(checkLimits, 3000); // Debounce check
    return () => clearTimeout(timer);
  }, [uid, stats.globalSpent, stats.spendingLimits, isExpired]);

  const healthStats = useMemo(() => {
    // Simplified Score Calculation
    const income = stats.income;
    const expense = stats.expense;
    const balance = income - expense;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;
    
    let balancePoints = 0;
    if (savingsRate >= 30) balancePoints = 100;
    else if (savingsRate >= 15) balancePoints = 85;
    else if (savingsRate >= 5) balancePoints = 70;
    else if (savingsRate >= 0) balancePoints = 50;
    else balancePoints = 20;

    const limitHealth = limits.length > 0 ? (limits.filter(l => l.spent <= l.limit).length / limits.length) * 100 : 100;
    const goalProgress = goals.length > 0 ? (goals.reduce((s, g) => s + (g.currentAmount / g.targetAmount || 0), 0) / goals.length) * 100 : 0;

    const score = Math.round((balancePoints * 0.5) + (limitHealth * 0.3) + (goalProgress * 0.2));
    
    let level = { label: 'Crítico', color: 'text-rose-500' };
    if (score > 85) level = { label: 'Excelente', color: 'text-emerald-500' };
    else if (score > 70) level = { label: 'Saudável', color: 'text-[#00A884]' };
    else if (score > 50) level = { label: 'Controlado', color: 'text-amber-500' };
    else if (score > 30) level = { label: 'Atenção', color: 'text-orange-500' };

    // Stress Level (based on balance)
    const impactPct = income > 0 ? Math.min(100, (expense / income) * 100) : 100;
    let stress = { level: 'Paz Total', color: '#00A884', desc: 'Suas finanças estão sob controle total.', impactPct };
    if (impactPct > 90) stress = { level: 'Crítico', color: '#ef4444', desc: 'Você está gastando quase tudo que ganha.', impactPct };
    else if (impactPct > 70) stress = { level: 'Impacto Alto', color: '#f97316', desc: 'Atenção ao volume de saídas este mês.', impactPct };
    else if (impactPct > 40) stress = { level: 'Moderado', color: '#f59e0b', desc: 'Equilíbrio razoável entre ganhos e gastos.', impactPct };

    return { score, level, stress };
  }, [stats, limits, goals]);

  const handleCreateLimit = async () => {
    if (!limitCat || !limitVal) return;
    const result = await dispatchEvent(uid, {
      type: 'UPDATE_LIMIT',
      payload: { 
        id: editingLimit?.id,
        category: limitCat, 
        amount: parseFloat(limitVal) 
      },
      source: 'ui',
      createdAt: new Date()
    });
    
    if (result && !result.success) {
      setNotification({ message: result.error || "Erro ao salvar limite.", type: 'error' });
      return;
    }

    setLimitCat(''); setLimitVal(''); setShowLimitModal(false); setEditingLimit(null);
  };

  const handleDeleteLimit = async (limitId: string) => {
    const result = await dispatchEvent(uid, {
      type: 'DELETE_LIMIT',
      payload: { id: limitId },
      source: 'ui',
      createdAt: new Date()
    });

    if (result && !result.success) {
      setNotification({ message: result.error || "Erro ao excluir limite.", type: 'error' });
      return;
    }
  };

  const handleSaveGlobalLimit = async () => {
    if (!globalLimitVal) return;
    const result = await dispatchEvent(uid, {
      type: 'UPDATE_USER',
      payload: { spendingLimit: Number(globalLimitVal) },
      source: 'ui',
      createdAt: new Date()
    });

    if (result && !result.success) {
      setNotification({ message: result.error || "Erro ao salvar limite global.", type: 'error' });
      return;
    }

    setShowGlobalLimitModal(false);
  };

  const handleDeleteGlobalLimit = async () => {
    await dispatchEvent(uid, {
      type: 'UPDATE_USER',
      payload: { spendingLimit: null },
      source: 'ui',
      createdAt: new Date()
    });
    setGlobalLimitVal('');
  };

  const handleSaveTransaction = async () => {
    const finalCategory = txCategory || 'Outros';
    if (!txDesc || txAmount <= 0 || !txWalletId) return;
    setIsSaving(true);
    try {
      const result = await dispatchEvent(uid, {
        type: txType === 'INCOME' ? 'ADD_INCOME' : 'ADD_EXPENSE',
        payload: {
          description: txDesc,
          amount: txAmount,
          category: finalCategory,
          date: txDate,
          sourceWalletId: txWalletId,
          targetWalletId: txWalletId,
          paymentMethod: txPaymentMethod || null
        },
        source: 'ui',
        createdAt: new Date()
      });

      if (result && !result.success) {
        setNotification({ message: result.error || "Erro ao salvar transação.", type: 'error' });
        setIsSaving(false);
        return;
      }

      setShowAddModal(false);
      // Reset form
      setTxDesc('');
      setTxAmount(0);
      setTxCategory('');
      setTxWalletId('');
      setTxPaymentMethod('');
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      setNotification({ message: "Erro interno ao salvar transação.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-8 animate-pulse">
        <div className="h-48 bg-[var(--surface)] rounded-[2.5rem]"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-[var(--surface)] rounded-[2rem]"></div>
          <div className="h-64 bg-[var(--surface)] rounded-[2rem]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-fade pb-32 relative z-10 max-w-7xl mx-auto">
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-end gap-6">
          <div>
            <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-2">Visão Geral Estratégica</p>
            <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Dashboard</h1>
          </div>
          <button 
            onClick={() => !isExpired && setShowAddModal(true)}
            disabled={isExpired}
            className={`hidden md:flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[11px] uppercase shadow-lg transition-all active:scale-95 ${isExpired ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed opacity-50' : 'bg-[var(--green-whatsapp)] text-white shadow-[var(--green-whatsapp)]/20 hover:scale-105'}`}
          >
            <Plus size={16} /> {isExpired ? 'Acesso Expirado' : 'Adicionar Manualmente'}
          </button>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm">
          <Calendar size={14} className="text-[var(--green-whatsapp)]" />
          <span className="text-[10px] font-black text-[var(--text-primary)] uppercase italic">
            {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())}
          </span>
        </div>
      </header>

      <OnboardingChecklist steps={onboardingSteps} />

      {dailyInsight && <DailyInsight insight={dailyInsight} />}

      {/* 1️⃣ Card Principal – Situação Financeira */}
      <MainStats stats={stats} />

      {/* 💡 Hub de Saúde Financeira (Lapidação) */}
      <FinancialHealthHub 
        score={healthStats.score} 
        level={healthStats.level} 
        stressLevel={healthStats.stress} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 2️⃣ Gráfico Financeiro do Mês */}
        <CashFlowChart barData={stats.barData} />

        {/* 5️⃣ Projeção do Fim do Mês */}
        <ProjectionCard projectedBalance={stats.projectedBalance} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 3️⃣ Ranking de Gastos */}
        <ExpenseRanking 
          ranking={stats.expenseRanking} 
          onCategoryClick={(cat) => setSelectedCategory(cat)}
          onSeeAll={() => setShowFullRanking(true)}
          limit={5}
        />

        <div className="flex flex-col gap-8">
          {/* 4️⃣ Teto de Gastos Global */}
          <GlobalSpendingLimitCard 
            limit={stats.globalLimit} 
            spent={stats.globalSpent} 
            onAdd={() => setShowGlobalLimitModal(true)}
            onEdit={() => setShowGlobalLimitModal(true)}
            onDelete={handleDeleteGlobalLimit}
          />

          {/* Limites por Categoria */}
          <SpendingLimitsCard 
            limits={stats.spendingLimits} 
            onAdd={() => {
              setEditingLimit(null);
              setLimitCat('');
              setLimitVal('');
              setShowLimitModal(true);
            }} 
            onEdit={(lim) => {
              setEditingLimit(lim);
              setLimitCat(lim.category);
              setLimitVal(lim.limit.toString());
              setShowLimitModal(true);
            }}
            onDelete={(lim) => handleDeleteLimit(lim.id)}
          />
        </div>

        {/* 9️⃣ Distribuição dos Gastos (Pie Chart) */}
        <CompositionChart pieData={stats.pieData} colors={stats.COLORS} totalExpense={stats.expense} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 6️⃣ Sugestão Financeira Automática */}
        <SuggestionCard suggestion={stats.suggestion} />

        {/* 8️⃣ Sugestão de Aporte para Metas */}
        {stats.goalSuggestion && (
          <GoalSuggestionCard 
            goalSuggestion={stats.goalSuggestion} 
            onApply={() => dispatchEvent(uid, { type: 'ADD_TO_GOAL', payload: { amount: stats.goalSuggestion, note: 'Aporte sugerido pelo Dashboard' }, source: 'ui', createdAt: new Date() })} 
          />
        )}
      </div>

      {/* 7️⃣ Contas Próximas do Vencimento */}
      <UpcomingBillsCard 
        bills={stats.upcomingBills} 
        onBillClick={() => onNavigateToTab?.('reminders')}
      />

      {/* Modal Limite Global */}
      <AnimatePresence>
        {showGlobalLimitModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGlobalLimitModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--surface)] w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative border border-[var(--border)] animate-fade"
            >
              <button 
                onClick={() => setShowGlobalLimitModal(false)} 
                className="absolute top-8 right-8 w-10 h-10 bg-[var(--bg-body)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90 border border-[var(--border)]"
              >
                ✕
              </button>
              
              <div className="text-center mb-8">
                <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-2">Planejamento</p>
                <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Teto de Gastos</h3>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Valor Limite Mensal</label>
                  <MoneyInput 
                    value={Number(globalLimitVal) || 0}
                    onChange={v => setGlobalLimitVal(v.toString())}
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-lg font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner"
                  />
                </div>
                
                <button 
                  onClick={handleSaveGlobalLimit}
                  className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-[var(--green-whatsapp)]/20 mt-4 active:scale-95 transition-all"
                >
                  Salvar Teto
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Limite */}
      <AnimatePresence>
        {showLimitModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLimitModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--surface)] w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative border border-[var(--border)] animate-fade"
            >
              <button 
                onClick={() => setShowLimitModal(false)} 
                className="absolute top-8 right-8 w-10 h-10 bg-[var(--bg-body)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90 border border-[var(--border)]"
              >
                ✕
              </button>
              
              <div className="text-center mb-8">
                <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-2">Planejamento</p>
                <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">
                  {editingLimit ? 'Editar Teto' : 'Definir Teto'}
                </h3>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Categoria</label>
                  <input 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner" 
                    placeholder="Ex: Alimentação, Lazer..." 
                    value={limitCat} 
                    onChange={e => setLimitCat(e.target.value)} 
                    disabled={!!editingLimit}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Valor Limite</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-2xl font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner text-center" 
                    placeholder="R$ 0,00" 
                    value={Number(limitVal) || 0} 
                    onChange={val => setLimitVal(val.toString())} 
                  />
                </div>

                <button 
                  onClick={handleCreateLimit} 
                  className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-[var(--green-whatsapp)]/20 mt-6 active:scale-95 transition-all"
                >
                  Ativar Monitoramento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* 9️⃣ Floating Action Button for Quick Add */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-6 w-16 h-16 bg-[var(--green-whatsapp)] text-white rounded-full shadow-2xl flex items-center justify-center z-[100] md:hidden border-4 border-[var(--bg-body)]"
      >
        <Plus size={32} />
      </motion.button>

      {/* Modal Ranking Completo */}
      <AnimatePresence>
        {showFullRanking && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFullRanking(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--surface)] w-full max-w-lg rounded-[3rem] p-10 shadow-2xl relative border border-[var(--border)] animate-fade max-h-[85vh] flex flex-col"
            >
              <button 
                onClick={() => setShowFullRanking(false)} 
                className="absolute top-8 right-8 w-10 h-10 bg-[var(--bg-body)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90 border border-[var(--border)]"
              >
                ✕
              </button>
              
              <div className="text-center mb-8">
                <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-2">Análise Completa</p>
                <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Ranking de Gastos</h3>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <ExpenseRanking 
                  ranking={stats.expenseRanking} 
                  onCategoryClick={(cat) => {
                    setSelectedCategory(cat);
                    setShowFullRanking(false);
                  }}
                  limit={0} // 0 means show all
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Detalhe de Categoria */}
      <AnimatePresence>
        {selectedCategory && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCategory(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--surface)] w-full max-w-2xl rounded-[3rem] p-8 shadow-2xl relative border border-[var(--border)] animate-fade max-h-[85vh] flex flex-col"
            >
              <button 
                onClick={() => setSelectedCategory(null)} 
                className="absolute top-6 right-6 w-10 h-10 bg-[var(--bg-body)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90 border border-[var(--border)]"
              >
                ✕
              </button>
              
              <div className="mb-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-[var(--green-whatsapp)]/20 rounded-2xl flex items-center justify-center text-[var(--green-whatsapp)]">
                  <TrendingDown size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em]">Detalhamento</p>
                  <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">{selectedCategory}</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Total Gasto</p>
                  <p className="text-xl font-black text-white">
                    {format(stats.expenseRanking.find(r => r.name === selectedCategory)?.value || 0)}
                  </p>
                </div>
                <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Lançamentos</p>
                  <p className="text-xl font-black text-white">
                    {transactions.filter(t => t.type === 'EXPENSE' && normalizeCategoryName(t.category) === selectedCategory && new Date(t.date).getMonth() === stats.currentMonth).length}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {transactions
                  .filter(t => t.type === 'EXPENSE' && normalizeCategoryName(t.category) === selectedCategory && new Date(t.date).getMonth() === stats.currentMonth)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(t => (
                    <div key={t.id} className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)] flex justify-between items-center group">
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-tight">{t.description}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[9px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                            <Calendar size={10} /> {new Date(t.date).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-[9px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                            <WalletIcon size={10} /> {t.walletName || 'Carteira'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">-{format(t.amount)}</p>
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">{t.paymentMethod || 'Dinheiro'}</p>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <button 
                  onClick={() => {
                    if (onNavigateToExtrato) {
                      onNavigateToExtrato({
                        category: selectedCategory,
                        startDate: new Date(stats.currentYear, stats.currentMonth, 1).toISOString().split('T')[0],
                        endDate: new Date(stats.currentYear, stats.currentMonth + 1, 0).toISOString().split('T')[0],
                        type: 'EXPENSE'
                      });
                    }
                  }}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/5 transition-all active:scale-95"
                >
                  Ver no Extrato Completo <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Adicionar Transação */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--surface)] w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative border border-[var(--border)] animate-fade max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowAddModal(false)} 
                className="absolute top-8 right-8 w-10 h-10 bg-[var(--bg-body)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90 border border-[var(--border)]"
              >
                ✕
              </button>
              
              <div className="text-center mb-8">
                <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-2">Registro Manual</p>
                <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Nova Transação</h3>
              </div>

              <div className="space-y-5">
                {/* Tipo de Transação */}
                <div className="flex p-1 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)]">
                  <button 
                    onClick={() => setTxType('EXPENSE')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${txType === 'EXPENSE' ? 'bg-rose-500 text-white shadow-lg' : 'text-[var(--text-muted)]'}`}
                  >
                    Gasto
                  </button>
                  <button 
                    onClick={() => setTxType('INCOME')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${txType === 'INCOME' ? 'bg-[var(--green-whatsapp)] text-white shadow-lg' : 'text-[var(--text-muted)]'}`}
                  >
                    Ganho
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Descrição</label>
                  <input 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner" 
                    placeholder="Ex: Almoço, Salário..." 
                    value={txDesc} 
                    onChange={e => setTxDesc(e.target.value)} 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Valor</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-2xl font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner text-center" 
                    placeholder="R$ 0,00" 
                    value={txAmount} 
                    onChange={val => setTxAmount(val)} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Categoria</label>
                    <select 
                      className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-xs font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner appearance-none"
                      value={txCategory}
                      onChange={e => setTxCategory(e.target.value)}
                    >
                      <option value="">Selecionar</option>
                      {categories.filter(c => c.type === txType).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Data</label>
                    <input 
                      type="date"
                      className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-xs font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner"
                      value={txDate}
                      onChange={e => setTxDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Carteira / Conta</label>
                    <select 
                      className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-xs font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner appearance-none"
                      value={txWalletId}
                      onChange={e => setTxWalletId(e.target.value)}
                    >
                      <option value="">Selecionar</option>
                      {wallets.filter(w => w.isActive !== false).map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Forma de Pagamento</label>
                    <select 
                      className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-xs font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner appearance-none"
                      value={txPaymentMethod}
                      onChange={e => setTxPaymentMethod(e.target.value)}
                    >
                      <option value="">Opcional</option>
                      <option value="PIX">Pix</option>
                      <option value="DEBIT">Débito</option>
                      <option value="CREDIT">Crédito</option>
                      <option value="CASH">Dinheiro</option>
                      <option value="TRANSFER">Transferência</option>
                    </select>
                  </div>
                </div>

                <button 
                  onClick={handleSaveTransaction} 
                  disabled={isSaving || !txDesc || txAmount <= 0 || !txWalletId}
                  className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-[var(--green-whatsapp)]/20 mt-6 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                  {isSaving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Salvar Transação'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
