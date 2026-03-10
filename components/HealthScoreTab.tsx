
import React, { useMemo } from 'react';
import { Transaction, CategoryLimit, SavingGoal } from '../types';
import { motion } from 'motion/react';
import { ShieldCheck, AlertTriangle, TrendingUp, Target, Activity, CheckCircle2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface HealthScoreTabProps {
  transactions: Transaction[];
  limits: CategoryLimit[];
  goals: SavingGoal[];
}

const HealthScoreTab: React.FC<HealthScoreTabProps> = ({ transactions = [], limits = [], goals = [] }) => {
  const scoreData = useMemo(() => {
    // 1. Balanço Mensal (Mês Atual)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = monthlyTransactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = monthlyTransactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const balance = income - expense;
    const savingsRate = income > 0 ? (balance / income) * 100 : (balance < 0 ? -100 : 0);

    // 2. Controle de Limites
    const activeLimits = limits.filter(l => l.isActive && l.limit > 0);
    const overspentLimits = activeLimits.filter(l => l.spent > l.limit);
    const limitHealth = activeLimits.length > 0 ? ((activeLimits.length - overspentLimits.length) / activeLimits.length) * 100 : 100;

    // 3. Consistência de Registro (Últimos 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentTransactions = transactions.filter(t => new Date(t.date) >= sevenDaysAgo);
    const consistencyScore = Math.min(100, (recentTransactions.length / 5) * 100); // 5 registros por semana é o ideal

    // 4. Progresso de Metas
    const goalsWithProgress = goals.filter(g => g.targetAmount > 0);
    const avgGoalProgress = goalsWithProgress.length > 0 
      ? goalsWithProgress.reduce((s, g) => s + (g.currentAmount / g.targetAmount), 0) / goalsWithProgress.length * 100
      : 0;
    const goalActivity = goals.some(g => {
        if (!g.updatedAt) return false;
        const updatedAt = g.updatedAt?.toDate ? g.updatedAt.toDate() : new Date(g.updatedAt);
        return updatedAt >= sevenDaysAgo;
    }) ? 100 : 50;

    // CÁLCULO FINAL DO SCORE (0-100)
    // Pesos:
    // 40% - Balanço/Sobra (O mais importante)
    // 20% - Limites (Controle)
    // 20% - Consistência (Hábito)
    // 20% - Metas (Futuro)

    let balancePoints = 0;
    if (savingsRate >= 30) balancePoints = 100;
    else if (savingsRate >= 15) balancePoints = 85;
    else if (savingsRate >= 5) balancePoints = 70;
    else if (savingsRate >= 0) balancePoints = 50;
    else if (savingsRate >= -20) balancePoints = 25;
    else balancePoints = 0;

    const finalScore = Math.round(
      (balancePoints * 0.4) + 
      (limitHealth * 0.2) + 
      (consistencyScore * 0.2) + 
      ((avgGoalProgress * 0.5 + goalActivity * 0.5) * 0.2)
    );

    // Níveis
    let level = { label: 'Situação Crítica', color: 'text-rose-500', bg: 'bg-rose-500/10', icon: '🔴' };
    if (finalScore > 85) level = { label: 'Excelente', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: '🟢' };
    else if (finalScore > 70) level = { label: 'Saudável', color: 'text-green-500', bg: 'bg-green-500/10', icon: '🟢' };
    else if (finalScore > 50) level = { label: 'Controlado', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: '🟡' };
    else if (finalScore > 30) level = { label: 'Atenção', color: 'text-orange-500', bg: 'bg-orange-500/10', icon: '🟠' };

    // Insights
    const helping = [];
    const hurting = [];
    const suggestions = [];

    if (balance > 0) helping.push("Você está mantendo saldo positivo este mês.");
    else hurting.push("Suas despesas estão superando suas entradas.");

    if (consistencyScore >= 80) helping.push("Você tem o hábito frequente de registrar seus gastos.");
    else hurting.push("Você está registrando poucos gastos ultimamente.");

    if (overspentLimits.length > 0) {
      hurting.push(`Você estourou o limite em ${overspentLimits.length} categorias.`);
      suggestions.push(`Tente reduzir os gastos em ${overspentLimits[0].category} para recuperar seu score.`);
    } else if (activeLimits.length > 0) {
      helping.push("Você está respeitando todos os seus limites de gastos.");
    }

    if (avgGoalProgress > 0) helping.push("Suas metas financeiras estão progredindo.");
    
    if (savingsRate < 10) suggestions.push("Tente guardar pelo menos 10% do que ganha para melhorar sua saúde.");
    if (recentTransactions.length < 3) suggestions.push("Registre mais gastos para que eu possa te dar insights precisos.");

    return {
      score: finalScore,
      level,
      helping,
      hurting,
      suggestions,
      income,
      expense,
      balance
    };
  }, [transactions, limits, goals]);

  return (
    <div className="p-6 space-y-8 animate-fade pb-32 max-w-2xl mx-auto">
      <header>
        <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Saúde Financeira</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Score GB</h1>
        <p className="text-[11px] text-[var(--text-muted)] font-medium mt-2 leading-relaxed">
          Seu score financeiro mostra como está sua saúde financeira baseada no seu comportamento real de gastos, economia e metas.
        </p>
      </header>

      {/* Score Principal */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[var(--surface)] rounded-[3rem] p-12 shadow-2xl border border-[var(--border)] flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-[var(--bg-body)]">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${scoreData.score}%` }}
            className={`h-full ${scoreData.score > 70 ? 'bg-emerald-500' : scoreData.score > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
          />
        </div>

        <div className="relative">
          <svg className="w-48 h-48 transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              className="text-[var(--bg-body)]"
            />
            <motion.circle
              cx="96"
              cy="96"
              r="88"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={553}
              initial={{ strokeDashoffset: 553 }}
              animate={{ strokeDashoffset: 553 - (553 * scoreData.score) / 100 }}
              className={`${scoreData.score > 70 ? 'text-emerald-500' : scoreData.score > 50 ? 'text-amber-500' : 'text-rose-500'}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl font-black text-[var(--text-primary)] tracking-tighter">{scoreData.score}</span>
            <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-widest">Pontos</span>
          </div>
        </div>

        <div className={`mt-8 px-6 py-2 rounded-full ${scoreData.level.bg} ${scoreData.level.color} flex items-center gap-2`}>
          <span className="text-sm">{scoreData.level.icon}</span>
          <span className="text-xs font-black uppercase tracking-widest">{scoreData.level.label}</span>
        </div>
      </motion.div>

      {/* Detalhes */}
      <div className="grid grid-cols-1 gap-6">
        {/* O que está ajudando */}
        {scoreData.helping.length > 0 && (
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="text-emerald-500" size={18} />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">O que está ajudando</h4>
            </div>
            <ul className="space-y-3">
              {scoreData.helping.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-xs font-medium text-[var(--text-primary)]">
                  <ArrowUpRight className="shrink-0 mt-0.5 text-emerald-500" size={14} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* O que está prejudicando */}
        {scoreData.hurting.length > 0 && (
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-rose-500" size={18} />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500">O que está prejudicando</h4>
            </div>
            <ul className="space-y-3">
              {scoreData.hurting.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-xs font-medium text-[var(--text-primary)]">
                  <ArrowDownRight className="shrink-0 mt-0.5 text-rose-500" size={14} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Como melhorar */}
        {scoreData.suggestions.length > 0 && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-8 text-[var(--text-primary)] shadow-xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-[var(--green-whatsapp)]" size={18} />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--green-whatsapp)]">Plano de Ação</h4>
            </div>
            <div className="space-y-4">
              {scoreData.suggestions.map((item, i) => (
                <p key={i} className="text-sm font-medium text-[var(--text-muted)] leading-relaxed">
                  "{item}"
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default HealthScoreTab;
