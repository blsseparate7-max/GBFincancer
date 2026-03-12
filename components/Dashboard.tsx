import React, { useMemo, useState } from 'react';
import { Transaction, SavingGoal, CategoryLimit, Wallet, Bill } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import { normalizeCategoryName } from '../services/normalizationService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Wallet as WalletIcon, PiggyBank, 
  AlertCircle, Calendar, Lightbulb, ArrowRight, Target,
  ChevronLeft, ChevronRight, Info, DollarSign, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MoneyInput from './MoneyInput';

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

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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

    const COLORS = ['#00a884', '#3b82f6', '#f59e0b', '#f43f5e', '#8b5cf6'];

    return { 
      income, expense, saldoLivre, totalSaved, expenseRanking, spendingLimits, 
      projectedBalance, suggestion, upcomingBills, goalSuggestion, barData, pieData, COLORS,
      dailyStats, daysInMonth, firstDayOfMonth, currentMonth, currentYear,
      highlights: { maxIncomeDay, maxExpenseDay, bestDay, worstDay, maxIncome, maxExpense }
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

  return (
    <div className="p-6 space-y-8 animate-fade pb-32 relative z-10 max-w-7xl mx-auto min-h-full">
      <header>
        <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Centro de Controle</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Dashboard</h1>
      </header>

      {/* 1️⃣ Card Principal – Situação Financeira */}
      <section className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--green-whatsapp)]/5 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-700" />
        
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Saldo Atual Disponível</p>
            <h3 className={`text-5xl font-black italic tracking-tighter ${stats.saldoLivre < 0 ? 'text-rose-500' : 'text-[var(--green-whatsapp)]'}`}>
              {format(stats.saldoLivre)}
            </h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Entradas</p>
              <p className="text-sm font-black text-[var(--green-whatsapp)]">{format(stats.income)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Saídas</p>
              <p className="text-sm font-black text-rose-500">{format(stats.expense)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Guardado</p>
              <p className="text-sm font-black text-blue-500">{format(stats.totalSaved)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2️⃣ Gráfico Financeiro do Mês */}
        <div className="lg:col-span-8 bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Fluxo Mensal</h3>
            <div className="flex gap-4 text-[9px] font-bold uppercase">
              <span className="flex items-center gap-1.5 text-[var(--green-whatsapp)]"><div className="w-2 h-2 rounded-full bg-[var(--green-whatsapp)]" /> Entradas</span>
              <span className="flex items-center gap-1.5 text-rose-500"><div className="w-2 h-2 rounded-full bg-rose-500" /> Saídas</span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--text-muted)' }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5️⃣ Projeção do Fim do Mês */}
        <div className="lg:col-span-4 bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm flex flex-col justify-center text-center space-y-4">
          <div className="w-12 h-12 bg-[var(--green-whatsapp)]/10 rounded-full flex items-center justify-center mx-auto">
            <Calendar className="text-[var(--green-whatsapp)]" size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Projeção Fim do Mês</p>
            <h4 className={`text-2xl font-black italic ${stats.projectedBalance < 0 ? 'text-rose-500' : 'text-[var(--green-whatsapp)]'}`}>
              {format(stats.projectedBalance)}
            </h4>
          </div>
          <p className="text-[11px] font-medium text-[var(--text-muted)] leading-relaxed">
            {stats.projectedBalance < 0 
              ? "Atenção! Se o ritmo de gastos continuar, você pode terminar o mês no negativo."
              : `Se continuar nesse ritmo de gastos, você terminará o mês com ${format(stats.projectedBalance)} disponíveis.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3️⃣ Ranking de Gastos */}
        <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm space-y-6">
          <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Ranking de Gastos</h3>
          <div className="space-y-5">
            {stats.expenseRanking.map((item, i) => (
              <div key={item.name} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">{i + 1}. {item.name}</span>
                  <span className="text-[10px] font-black text-[var(--text-muted)]">{item.percentage.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-body)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--green-whatsapp)]" style={{ width: `${item.percentage}%` }} />
                </div>
                <p className="text-[9px] font-bold text-[var(--text-muted)] text-right">{format(item.value)}</p>
              </div>
            ))}
            {stats.expenseRanking.length === 0 && <p className="text-[10px] text-[var(--text-muted)] italic">Nenhum gasto este mês.</p>}
          </div>
        </div>

        {/* 4️⃣ Limites de Gastos */}
        <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Limites Ativos</h3>
            <button onClick={() => setShowLimitModal(true)} className="text-[9px] font-black text-[var(--green-whatsapp)] uppercase">+ Novo</button>
          </div>
          <div className="space-y-6">
            {stats.spendingLimits.slice(0, 4).map(lim => (
              <div key={lim.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase">{lim.category}</span>
                  {lim.pct >= 80 && <AlertCircle size={12} className="text-amber-500 animate-pulse" />}
                </div>
                <div className="h-2 w-full bg-[var(--bg-body)] rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${lim.pct >= 100 ? 'bg-rose-500' : lim.pct >= 80 ? 'bg-amber-400' : 'bg-[var(--green-whatsapp)]'}`} 
                    style={{ width: `${Math.min(100, lim.pct)}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-[var(--text-muted)]">
                  <span>{format(lim.spent)} / {format(lim.limit)}</span>
                  <span>{lim.pct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
            {stats.spendingLimits.length === 0 && <p className="text-[10px] text-[var(--text-muted)] italic">Nenhum limite configurado.</p>}
          </div>
        </div>

        {/* 9️⃣ Distribuição dos Gastos (Pie Chart) */}
        <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm space-y-4">
          <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Distribuição</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={stats.COLORS[index % stats.COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)', fontSize: '10px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {stats.expenseRanking.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stats.COLORS[i % stats.COLORS.length] }} />
                <span className="text-[9px] font-bold text-[var(--text-muted)] truncate uppercase">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 6️⃣ Sugestão Financeira Automática */}
        <div className="bg-[var(--green-whatsapp)]/5 p-8 rounded-[2.5rem] border border-[var(--green-whatsapp)]/20 shadow-sm flex items-start gap-6">
          <div className="w-12 h-12 bg-[var(--green-whatsapp)] rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-[var(--green-whatsapp)]/20">
            <Lightbulb className="text-white" size={24} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-black text-[var(--green-whatsapp)] uppercase tracking-widest">Sugestão Inteligente</h3>
            {stats.suggestion ? (
              <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                A categoria <span className="font-black">{stats.suggestion.category}</span> representa <span className="font-black">{stats.suggestion.percentage}%</span> das suas despesas. 
                Reduzir 10% desse gasto pode melhorar sua sobra mensal em <span className="font-black text-[var(--green-whatsapp)]">{format(stats.suggestion.saving)}</span>.
              </p>
            ) : (
              <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                Continue registrando seus gastos para que eu possa gerar sugestões personalizadas para você!
              </p>
            )}
          </div>
        </div>

        {/* 8️⃣ Sugestão de Aporte para Metas */}
        {stats.goalSuggestion && (
          <div className="bg-blue-500/5 p-8 rounded-[2.5rem] border border-blue-500/20 shadow-sm flex items-center justify-between gap-6">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                <Target className="text-white" size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Oportunidade de Aporte</h3>
                <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                  Você pode guardar aproximadamente <span className="font-black text-blue-500">{format(stats.goalSuggestion)}</span> este mês sem comprometer seu orçamento.
                </p>
              </div>
            </div>
            <button 
              onClick={() => dispatchEvent(uid, { type: 'ADD_TO_GOAL', payload: { amount: stats.goalSuggestion, note: 'Aporte sugerido pelo Dashboard' }, source: 'ui', createdAt: new Date() })}
              className="bg-blue-500 text-white p-3 rounded-xl hover:scale-105 transition-all shadow-lg shadow-blue-500/20"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* 7️⃣ Contas Próximas do Vencimento */}
      <section className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm space-y-6">
        <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Contas Próximas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.upcomingBills.length > 0 ? (
            stats.upcomingBills.map(bill => (
              <div key={bill.id} className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] flex justify-between items-center">
                <div>
                  <p className="text-xs font-black text-[var(--text-primary)] uppercase">{bill.description}</p>
                  <p className={`text-[9px] font-bold uppercase ${bill.daysLeft <= 1 ? 'text-rose-500' : 'text-[var(--text-muted)]'}`}>
                    {bill.daysLeft === 0 ? 'Vence hoje' : bill.daysLeft === 1 ? 'Vence amanhã' : `Vence em ${bill.daysLeft} dias`}
                  </p>
                </div>
                <p className="text-sm font-black text-[var(--text-primary)]">{format(bill.amount)}</p>
              </div>
            ))
          ) : (
            <div className="col-span-3 py-4 text-center">
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase italic">Nenhuma conta próxima do vencimento.</p>
            </div>
          )}
        </div>
      </section>

      {/* Modal Limite */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[var(--surface)] w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative border border-[var(--border)] animate-fade">
            <button onClick={() => setShowLimitModal(false)} className="absolute top-8 right-8 text-[var(--text-muted)] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-6">Configurar Teto</h3>
            <div className="space-y-4">
              <input className="w-full bg-[var(--bg-body)] rounded-xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)]" placeholder="Categoria (Ex: Lanche)" value={limitCat} onChange={e => setLimitCat(e.target.value)} />
              <MoneyInput 
                className="w-full bg-[var(--bg-body)] rounded-xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)]" 
                placeholder="Limite R$" 
                value={Number(limitVal) || 0} 
                onChange={val => setLimitVal(val.toString())} 
              />
              <button onClick={handleCreateLimit} className="w-full bg-[var(--green-whatsapp)] text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-lg mt-4">Ativar Teto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
