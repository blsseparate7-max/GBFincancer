import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, SavingGoal, CategoryLimit, Wallet, Bill } from '../types';
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

interface DashProps {
  transactions: Transaction[];
  goals: SavingGoal[];
  limits: CategoryLimit[];
  wallets: Wallet[];
  reminders: Bill[];
  uid: string;
  loading?: boolean;
}

const Dashboard: React.FC<DashProps> = ({ transactions, goals, limits, wallets, reminders, uid, loading }) => {
  const [showLimitModal, setShowLimitModal] = useState(false);
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
        <div>
          <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-2">Visão Geral Estratégica</p>
          <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm">
          <Calendar size={14} className="text-[var(--green-whatsapp)]" />
          <span className="text-[10px] font-black text-[var(--text-primary)] uppercase italic">
            {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())}
          </span>
        </div>
      </header>

      <OnboardingChecklist steps={onboardingSteps} />

      {dailyInsight && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-[#00a884] to-[#008069] p-6 rounded-[2.5rem] text-white shadow-xl flex items-center gap-6 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Sparkles size={80} />
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
            <Lightbulb size={24} />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1 opacity-80">Dica do Mentor GB</p>
            <p className="text-sm font-black italic leading-tight tracking-tight">"{dailyInsight}"</p>
          </div>
        </motion.div>
      )}

      {/* 1️⃣ Card Principal – Situação Financeira */}
      <section className="bg-[var(--surface)] p-8 md:p-12 rounded-[3rem] border border-[var(--border)] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--green-whatsapp)]/5 rounded-full -mr-48 -mt-48 transition-transform group-hover:scale-110 duration-1000" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--accent-gold)]/5 rounded-full -ml-32 -mb-32 transition-transform group-hover:scale-110 duration-1000" />
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1 bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/20 rounded-full flex items-center gap-2">
                <Trophy size={12} className="text-[var(--accent-gold)]" />
                <span className="text-[10px] font-black text-[var(--accent-gold)] uppercase tracking-widest">Nível {stats.userLevel.level}</span>
              </div>
              <div className="flex-1 h-1 bg-[var(--bg-body)] rounded-full overflow-hidden max-w-[100px]">
                <div className="h-full bg-[var(--accent-gold)]" style={{ width: `${stats.userLevel.progress}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[var(--green-whatsapp)] animate-pulse" />
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Saldo Disponível em Conta</p>
            </div>
            <h3 className={`text-6xl md:text-7xl font-black italic tracking-tighter leading-none ${stats.saldoLivre < 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
              {format(stats.saldoLivre)}
            </h3>
            <div className="flex items-center gap-4 pt-4">
              <div className="px-3 py-1 bg-[var(--green-whatsapp)]/10 rounded-full border border-[var(--green-whatsapp)]/20">
                <p className="text-[9px] font-black text-[var(--green-whatsapp)] uppercase italic">Saudável</p>
              </div>
              <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase italic">Atualizado agora</p>
            </div>
          </div>
          
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-4 bg-[var(--bg-body)]/50 rounded-3xl border border-[var(--border)] backdrop-blur-sm space-y-1">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Entradas</p>
              <p className="text-lg font-black text-[var(--green-whatsapp)] italic leading-none">{format(stats.income)}</p>
            </div>
            <div className="p-4 bg-[var(--bg-body)]/50 rounded-3xl border border-[var(--border)] backdrop-blur-sm space-y-1">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Saídas</p>
              <p className="text-lg font-black text-rose-500 italic leading-none">{format(stats.expense)}</p>
            </div>
            <div className="p-4 bg-[var(--bg-body)]/50 rounded-3xl border border-[var(--border)] backdrop-blur-sm space-y-1">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Metas</p>
              <p className="text-lg font-black text-[var(--accent-gold)] italic leading-none">{format(stats.totalSaved)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 2️⃣ Gráfico Financeiro do Mês */}
        <div className="lg:col-span-8 bg-[var(--surface)] p-8 md:p-10 rounded-[3rem] border border-[var(--border)] shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
            <div>
              <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Fluxo de Caixa</h3>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase italic">Comparativo mensal de performance</p>
            </div>
            <div className="flex gap-6 text-[10px] font-black uppercase italic">
              <span className="flex items-center gap-2 text-[var(--green-whatsapp)]"><div className="w-3 h-3 rounded-lg bg-[var(--green-whatsapp)] shadow-sm shadow-[var(--green-whatsapp)]/20" /> Entradas</span>
              <span className="flex items-center gap-2 text-rose-500"><div className="w-3 h-3 rounded-lg bg-rose-500 shadow-sm shadow-rose-500/20" /> Saídas</span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--green-whatsapp)" stopOpacity={1}/>
                    <stop offset="100%" stopColor="var(--green-whatsapp)" stopOpacity={0.6}/>
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '900', fill: 'var(--text-muted)' }} />
                <Tooltip 
                  cursor={{ fill: 'var(--bg-body)', opacity: 0.1 }}
                  contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '1.5rem', border: '1px solid var(--border)', fontSize: '12px', fontWeight: '900', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={80} animationDuration={1500}>
                  {stats.barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'url(#incomeGradient)' : 'url(#expenseGradient)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5️⃣ Projeção do Fim do Mês */}
        <div className="lg:col-span-4 bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm flex flex-col justify-center text-center space-y-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-body)]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 bg-[var(--green-whatsapp)]/10 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner relative z-10">
            <Calendar className="text-[var(--green-whatsapp)]" size={32} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2">Projeção Inteligente</p>
            <h4 className={`text-4xl font-black italic tracking-tighter leading-none ${stats.projectedBalance < 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
              {format(stats.projectedBalance)}
            </h4>
          </div>
          <div className="relative z-10 p-4 bg-[var(--bg-body)]/50 rounded-2xl border border-[var(--border)]">
            <p className="text-[11px] font-bold text-[var(--text-primary)] leading-relaxed italic">
              {stats.projectedBalance < 0 
                ? "Alerta crítico! Sua projeção indica déficit. Recomenda-se revisão imediata de gastos variáveis."
                : `Performance positiva. Mantendo o ritmo atual, sua reserva livre será de ${format(stats.projectedBalance)}.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 3️⃣ Ranking de Gastos */}
        <div className="bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm space-y-8">
          <div>
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Top Categorias</h3>
            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Onde seu dinheiro está indo</p>
          </div>
          <div className="space-y-6">
            {stats.expenseRanking.map((item, i) => (
              <div key={item.name} className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-[11px] font-black text-[var(--text-primary)] uppercase italic tracking-tight">{i + 1}. {item.name}</span>
                  <span className="text-[10px] font-black text-[var(--text-muted)] italic">{item.percentage.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full bg-[var(--bg-body)] rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-[var(--green-whatsapp)] to-emerald-400" 
                  />
                </div>
                <p className="text-[10px] font-black text-[var(--text-primary)] text-right italic">{format(item.value)}</p>
              </div>
            ))}
            {stats.expenseRanking.length === 0 && (
              <div className="py-10 text-center opacity-20">
                <Info size={32} className="mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase italic">Sem dados de gastos</p>
              </div>
            )}
          </div>
        </div>

        {/* 4️⃣ Limites de Gastos */}
        <div className="bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Tetos de Gastos</h3>
              <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Controle de limites ativos</p>
            </div>
            <button 
              onClick={() => setShowLimitModal(true)} 
              className="w-10 h-10 bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)] rounded-xl flex items-center justify-center hover:scale-110 transition-all active:scale-90 border border-[var(--green-whatsapp)]/20 shadow-sm"
            >
              <DollarSign size={18} />
            </button>
          </div>
          <div className="space-y-8">
            {stats.spendingLimits.slice(0, 4).map(lim => (
              <div key={lim.id} className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-[var(--text-primary)] uppercase italic tracking-tight">{lim.category}</span>
                  {lim.pct >= 80 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                      <AlertCircle size={10} className="text-amber-500 animate-pulse" />
                      <span className="text-[8px] font-black text-amber-500 uppercase italic">Alerta</span>
                    </div>
                  )}
                </div>
                <div className="h-2.5 w-full bg-[var(--bg-body)] rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, lim.pct)}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={`h-full transition-all duration-1000 ${lim.pct >= 100 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : lim.pct >= 80 ? 'bg-amber-400' : 'bg-[var(--green-whatsapp)]'}`} 
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black italic">
                  <span className="text-[var(--text-muted)] uppercase">{format(lim.spent)} <span className="opacity-30">/</span> {format(lim.limit)}</span>
                  <span className={lim.pct >= 100 ? 'text-rose-500' : 'text-[var(--text-primary)]'}>{lim.pct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
            {stats.spendingLimits.length === 0 && (
              <div className="py-10 text-center opacity-20">
                <Target size={32} className="mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase italic">Nenhum teto definido</p>
              </div>
            )}
          </div>
        </div>

        {/* 9️⃣ Distribuição dos Gastos (Pie Chart) */}
        <div className="bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm space-y-6">
          <div>
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Composição</h3>
            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Mix de despesas por volume</p>
          </div>
          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={8}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={stats.COLORS[index % stats.COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '1.5rem', border: '1px solid var(--border)', fontSize: '10px', fontWeight: '900', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total</p>
                <p className="text-xs font-black text-[var(--text-primary)] italic">{format(stats.expense)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stats.expenseRanking.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 p-2 bg-[var(--bg-body)]/40 rounded-xl border border-[var(--border)]">
                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: stats.COLORS[i % stats.COLORS.length] }} />
                <span className="text-[9px] font-black text-[var(--text-primary)] truncate uppercase italic">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 6️⃣ Sugestão Financeira Automática */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-[var(--green-whatsapp)]/5 p-10 rounded-[3rem] border border-[var(--green-whatsapp)]/20 shadow-xl shadow-[var(--green-whatsapp)]/5 flex flex-col sm:flex-row items-start gap-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Lightbulb size={120} />
          </div>
          <div className="w-16 h-16 bg-[var(--green-whatsapp)] rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-2xl shadow-[var(--green-whatsapp)]/40 relative z-10">
            <Lightbulb className="text-white" size={32} />
          </div>
          <div className="space-y-4 relative z-10">
            <h3 className="text-xs font-black text-[var(--green-whatsapp)] uppercase tracking-[0.3em]">Insights de Inteligência</h3>
            {stats.suggestion ? (
              <p className="text-base font-medium text-[var(--text-primary)] leading-relaxed italic">
                Sua categoria <span className="font-black text-[var(--green-whatsapp)] underline decoration-dotted underline-offset-4">{stats.suggestion.category}</span> está consumindo <span className="font-black">{stats.suggestion.percentage}%</span> do orçamento. 
                Uma otimização de apenas 10% aqui liberaria <span className="font-black text-[var(--green-whatsapp)] bg-[var(--green-whatsapp)]/10 px-2 py-0.5 rounded-lg">{format(stats.suggestion.saving)}</span> extras por mês.
              </p>
            ) : (
              <p className="text-base font-medium text-[var(--text-primary)] leading-relaxed italic">
                Continue alimentando o sistema com suas transações. Em breve, gerarei estratégias personalizadas para otimizar sua saúde financeira.
              </p>
            )}
          </div>
        </motion.div>

        {/* 8️⃣ Sugestão de Aporte para Metas */}
        {stats.goalSuggestion && (
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-[var(--accent-gold)]/5 p-10 rounded-[3rem] border border-[var(--accent-gold)]/20 shadow-xl shadow-[var(--accent-gold)]/5 flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Target size={120} />
            </div>
            <div className="flex flex-col sm:flex-row items-start gap-8 relative z-10">
              <div className="w-16 h-16 bg-[var(--accent-gold)] rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-2xl shadow-[var(--accent-gold)]/40">
                <Target className="text-white" size={32} />
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-black text-[var(--accent-gold)] uppercase tracking-[0.3em]">Aceleração de Metas</h3>
                <p className="text-base font-medium text-[var(--text-primary)] leading-relaxed italic">
                  Identificamos uma folga de <span className="font-black text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 px-2 py-0.5 rounded-lg">{format(stats.goalSuggestion)}</span> no seu fluxo. 
                  Deseja aplicar este valor agora para atingir seus objetivos mais rápido?
                </p>
              </div>
            </div>
            <button 
              onClick={() => dispatchEvent(uid, { type: 'ADD_TO_GOAL', payload: { amount: stats.goalSuggestion, note: 'Aporte sugerido pelo Dashboard' }, source: 'ui', createdAt: new Date() })}
              className="bg-[var(--accent-gold)] text-white w-16 h-16 rounded-[1.5rem] flex items-center justify-center hover:scale-110 transition-all shadow-2xl shadow-[var(--accent-gold)]/30 active:scale-90 shrink-0"
            >
              <ArrowRight size={28} />
            </button>
          </motion.div>
        )}
      </div>

      {/* 7️⃣ Contas Próximas do Vencimento */}
      <section className="bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Agenda de Pagamentos</h3>
            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Compromissos financeiros imediatos</p>
          </div>
          <div className="px-3 py-1 bg-rose-500/10 rounded-full border border-rose-500/20">
            <p className="text-[8px] font-black text-rose-500 uppercase italic">Atenção</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.upcomingBills.length > 0 ? (
            stats.upcomingBills.map(bill => (
              <div key={bill.id} className="p-6 bg-[var(--bg-body)]/50 rounded-3xl border border-[var(--border)] flex justify-between items-center group hover:border-[var(--text-primary)] transition-all shadow-sm">
                <div className="space-y-1">
                  <p className="text-xs font-black text-[var(--text-primary)] uppercase italic tracking-tight">{bill.description}</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${bill.daysLeft <= 1 ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`} />
                    <p className={`text-[9px] font-black uppercase italic ${bill.daysLeft <= 1 ? 'text-rose-500' : 'text-[var(--text-muted)]'}`}>
                      {bill.daysLeft === 0 ? 'Vence hoje' : bill.daysLeft === 1 ? 'Vence amanhã' : `Vence em ${bill.daysLeft} dias`}
                    </p>
                  </div>
                </div>
                <p className="text-base font-black text-[var(--text-primary)] italic">{format(bill.amount)}</p>
              </div>
            ))
          ) : (
            <div className="col-span-3 py-12 text-center bg-[var(--bg-body)]/30 rounded-[2.5rem] border border-dashed border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] font-black uppercase italic tracking-widest">Nenhum compromisso pendente para os próximos dias.</p>
            </div>
          )}
        </div>
      </section>

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
        onClick={() => {
          // Logic to open chat with focus or a quick modal
          const chatInput = document.querySelector('textarea');
          if (chatInput) {
            chatInput.focus();
            // We could also scroll to chat
            chatInput.scrollIntoView({ behavior: 'smooth' });
          }
        }}
        className="fixed bottom-24 right-6 w-16 h-16 bg-[var(--green-whatsapp)] text-white rounded-full shadow-2xl flex items-center justify-center z-[100] md:hidden border-4 border-[var(--bg-body)]"
      >
        <Plus size={32} />
      </motion.button>
    </div>
  );
};

export default Dashboard;
