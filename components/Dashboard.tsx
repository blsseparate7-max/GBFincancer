import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, SavingGoal, CategoryLimit, Wallet, Bill, UserCategory } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
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
import { GoogleGenAI } from "@google/genai";
import { 
  DailyInsight, 
  MainStats, 
  CashFlowChart, 
  ProjectionCard, 
  ExpenseRanking, 
  SpendingLimitsCard, 
  CompositionChart, 
  UpcomingBillsCard,
  SuggestionCard,
  GoalSuggestionCard
} from './DashboardComponents';

interface DashProps {
  transactions: Transaction[];
  goals: SavingGoal[];
  limits: CategoryLimit[];
  wallets: Wallet[];
  reminders: Bill[];
  categories: UserCategory[];
  uid: string;
  loading?: boolean;
}

const Dashboard: React.FC<DashProps> = ({ transactions, goals, limits, wallets, reminders, categories, uid, loading }) => {
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Transaction Form State
  const [txType, setTxType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txCategory, setTxCategory] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txWalletId, setTxWalletId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [limitCat, setLimitCat] = useState('');
  const [limitVal, setLimitVal] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dailyInsight, setDailyInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    // Filter transactions for current month
    const monthTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = monthTransactions
      .filter(t => t.type === 'INCOME')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    
    const expense = monthTransactions
      .filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    
    const totalSaved = goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);
    const activeWallets = wallets.filter(w => w.isActive !== false);
    const saldoLivre = activeWallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);

    // Daily Stats for Calendar
    const dailyStats: Record<number, { income: number; expense: number; transactions: Transaction[] }> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      dailyStats[i] = { income: 0, expense: 0, transactions: [] };
    }

    monthTransactions.forEach(t => {
      const d = new Date(t.date).getDate();
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

    // Expense Ranking
    const expenseCategories = monthTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, t) => {
        const cat = normalizeCategoryName(t.category || 'Outros');
        acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
        return acc;
      }, {} as Record<string, number>);

    const totalExpenses: number = Object.values(expenseCategories).reduce((a, b) => Number(a) + Number(b), 0) as number;
    
    const expenseRanking: { name: string; value: number; percentage: number }[] = Object.entries(expenseCategories)
      .map(([name, value]) => ({
        name,
        value: Number(value),
        percentage: totalExpenses > 0 ? (Number(value) / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Spending Limits
    const spendingLimits = limits.map(lim => {
      const pct = lim.limit > 0 ? (lim.spent / lim.limit) * 100 : 0;
      return { ...lim, pct };
    }).sort((a, b) => b.pct - a.pct);

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

    const pieData = expenseRanking.map(item => ({
      name: item.name,
      value: item.value
    }));

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
      income, expense, saldoLivre, totalSaved, expenseRanking, spendingLimits, 
      projectedBalance, suggestion, upcomingBills, goalSuggestion, barData, pieData, COLORS,
      dailyStats, daysInMonth, firstDayOfMonth, currentMonth, currentYear,
      highlights: { maxIncomeDay, maxExpenseDay, bestDay, worstDay, maxIncome, maxExpense },
      userLevel
    };
  }, [transactions, goals, limits, wallets, reminders]);

  const handleCreateLimit = async () => {
    if (!limitCat || !limitVal) return;
    await dispatchEvent(uid, {
      type: 'UPDATE_LIMIT',
      payload: { category: limitCat, amount: parseFloat(limitVal) },
      source: 'ui',
      createdAt: new Date()
    });
    setLimitCat(''); setLimitVal(''); setShowLimitModal(false);
  };

  const handleSaveTransaction = async () => {
    if (!txDesc || txAmount <= 0 || !txCategory || !txWalletId) return;
    setIsSaving(true);
    try {
      await dispatchEvent(uid, {
        type: txType === 'INCOME' ? 'ADD_INCOME' : 'ADD_EXPENSE',
        payload: {
          description: txDesc,
          amount: txAmount,
          category: txCategory,
          date: txDate,
          sourceWalletId: txWalletId,
          paymentMethod: 'CASH' // Default for manual entry
        },
        source: 'ui',
        createdAt: new Date()
      });
      setShowAddModal(false);
      // Reset form
      setTxDesc('');
      setTxAmount(0);
      setTxCategory('');
      setTxWalletId('');
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
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

  return (    <div className="p-4 md:p-8 space-y-8 animate-fade pb-32 relative z-10 max-w-7xl mx-auto min-h-full">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-end gap-6">
          <div>
            <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-2">Visão Geral Estratégica</p>
            <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Dashboard</h1>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="hidden md:flex items-center gap-2 px-6 py-3 bg-[var(--green-whatsapp)] text-white rounded-2xl font-black text-[11px] uppercase shadow-lg shadow-[var(--green-whatsapp)]/20 hover:scale-105 transition-all active:scale-95"
          >
            <Plus size={16} /> Adicionar Manualmente
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 2️⃣ Gráfico Financeiro do Mês */}
        <CashFlowChart barData={stats.barData} />

        {/* 5️⃣ Projeção do Fim do Mês */}
        <ProjectionCard projectedBalance={stats.projectedBalance} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 3️⃣ Ranking de Gastos */}
        <ExpenseRanking ranking={stats.expenseRanking} />

        {/* 4️⃣ Limites de Gastos */}
        <SpendingLimitsCard limits={stats.spendingLimits} onAdd={() => setShowLimitModal(true)} />

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
      <UpcomingBillsCard bills={stats.upcomingBills} />

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
                <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Definir Teto</h3>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Categoria</label>
                  <input 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner" 
                    placeholder="Ex: Alimentação, Lazer..." 
                    value={limitCat} 
                    onChange={e => setLimitCat(e.target.value)} 
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

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-4 tracking-widest">Carteira / Conta</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-xs font-black text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all shadow-inner appearance-none"
                    value={txWalletId}
                    onChange={e => setTxWalletId(e.target.value)}
                  >
                    <option value="">Selecionar Carteira</option>
                    {wallets.filter(w => w.isActive !== false).map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({format(w.balance)})</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={handleSaveTransaction} 
                  disabled={isSaving || !txDesc || txAmount <= 0 || !txCategory || !txWalletId}
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
