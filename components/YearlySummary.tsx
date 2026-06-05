
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, SavingGoal, Wallet } from '../types';
import { parseSafeDate } from '../services/dateUtils';
import ChartNetWorth from './ChartNetWorth';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  PieChart, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  X, 
  Sparkles, 
  Target, 
  Clock,
  ChevronRight
} from 'lucide-react';

interface YearlySummaryProps {
  transactions: Transaction[];
  goals: SavingGoal[];
  wallets: Wallet[];
}

const YearlySummary: React.FC<YearlySummaryProps> = ({ transactions, goals, wallets }) => {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [inspectedMonthIndex, setInspectedMonthIndex] = useState<number | null>(null);
  const [comparisonMonthIndex, setComparisonMonthIndex] = useState<number | null>(null);

  // Extrair todos os anos das transações de forma dinâmica
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    transactions.forEach(t => {
      const d = parseSafeDate(t.date || (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toISOString() : null));
      if (d && !isNaN(d.getFullYear())) {
        yearsSet.add(d.getFullYear());
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  // Consolidar dados financeiros anuais do ano selecionado
  const yearData = useMemo(() => {
    const data = months.map((monthName, index) => {
      const monthTrans = transactions.filter(t => {
        const d = parseSafeDate(t.date || (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toISOString() : null));
        return d.getMonth() === index && d.getFullYear() === selectedYear;
      });

      const income = monthTrans.filter(t => t.type === 'INCOME').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const expense = monthTrans.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const balance = income - expense;

      // Group month expenses by category for month details
      const mCategories: Record<string, number> = {};
      monthTrans.filter(t => t.type === 'EXPENSE').forEach(t => {
        const cat = t.category || 'Outros';
        mCategories[cat] = (mCategories[cat] || 0) + (Number(t.amount) || 0);
      });

      const topMonthCategories = Object.entries(mCategories)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

      return { 
        name: monthName, 
        income, 
        expense, 
        balance, 
        hasData: monthTrans.length > 0,
        transactions: monthTrans,
        topCategories: topMonthCategories
      };
    });

    const totalIncome = data.reduce((s, m) => s + m.income, 0);
    const totalExpense = data.reduce((s, m) => s + m.expense, 0);
    const totalBalance = totalIncome - totalExpense;

    // Taxa de poupança acumulada do ano
    const savingsRate = totalIncome > 0 ? (totalBalance / totalIncome) * 100 : 0;

    // Identificar melhor mês de saldo líquido positivo
    const activeMonths = data.filter(m => m.hasData);
    let bestMonth = null;
    if (activeMonths.length > 0) {
      bestMonth = activeMonths.reduce((prevBest, curr) => curr.balance > prevBest.balance ? curr : prevBest, activeMonths[0]);
    }

    // Médias mensais gerais
    const avgMonthlyIncome = totalIncome / 12;
    const avgMonthlyExpense = totalExpense / 12;

    // Categorias mais consumidas no ano de modo agregado
    const yearCategoriesExpenses: Record<string, number> = {};
    transactions.forEach(t => {
      const d = parseSafeDate(t.date || (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toISOString() : null));
      if (t.type === 'EXPENSE' && d.getFullYear() === selectedYear) {
        const cat = t.category || 'Outros';
        yearCategoriesExpenses[cat] = (yearCategoriesExpenses[cat] || 0) + (Number(t.amount) || 0);
      }
    });

    const topYearCategoriesList = Object.entries(yearCategoriesExpenses)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      monthly: data,
      totalIncome,
      totalExpense,
      totalBalance,
      savingsRate,
      bestMonth: bestMonth ? { name: bestMonth.name, balance: bestMonth.balance } : null,
      avgMonthlyIncome,
      avgMonthlyExpense,
      topYearCategories: topYearCategoriesList
    };
  }, [transactions, selectedYear]);

  // Consolidado comparativo de gastos por categoria entre dois meses
  const comparisonData = useMemo(() => {
    if (inspectedMonthIndex === null || comparisonMonthIndex === null) return null;

    const monthA = yearData.monthly[inspectedMonthIndex];
    const monthB = yearData.monthly[comparisonMonthIndex];

    // Mapear todas as categorias com despesas no mês A
    const categoriesA: Record<string, number> = {};
    monthA.transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const cat = t.category || 'Outros';
      categoriesA[cat] = (categoriesA[cat] || 0) + (Number(t.amount) || 0);
    });

    // Mapear todas as categorias com despesas no mês B
    const categoriesB: Record<string, number> = {};
    monthB.transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const cat = t.category || 'Outros';
      categoriesB[cat] = (categoriesB[cat] || 0) + (Number(t.amount) || 0);
    });

    // Obter lista unificada de todas as categorias
    const allCatNames = Array.from(new Set([...Object.keys(categoriesA), ...Object.keys(categoriesB)]));

    const list = allCatNames.map(name => {
      const amountA = categoriesA[name] || 0;
      const amountB = categoriesB[name] || 0;
      const diff = amountA - amountB;
      const percentDiff = amountB > 0 ? (diff / amountB) * 100 : amountA > 0 ? 100 : 0;
      return {
        name,
        amountA,
        amountB,
        diff,
        percentDiff
      };
    }).sort((a, b) => Math.max(b.amountA, b.amountB) - Math.max(a.amountA, a.amountB));

    return list;
  }, [inspectedMonthIndex, comparisonMonthIndex, yearData]);

  // Contribuições feitas em Metas poupadas no ano selecionado
  const totalGoalsSavedThisYear = useMemo(() => {
    let sum = 0;
    goals.forEach(g => {
      if (g.contributions) {
        g.contributions.forEach(c => {
          const d = parseSafeDate(c.date);
          if (d.getFullYear() === selectedYear) {
            sum += Number(c.amount) || 0;
          }
        });
      }
    });
    return sum;
  }, [goals, selectedYear]);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Status de taxa de poupança recomendada
  const { rateStatus, rateColor } = useMemo(() => {
    const rate = yearData.savingsRate;
    if (yearData.totalIncome === 0) return { rateStatus: 'Sem dados', rateColor: 'var(--text-muted)' };
    if (rate < 0) return { rateStatus: 'Déficit no Período', rateColor: '#ef4444' };
    if (rate < 10) return { rateStatus: 'Abaixo da Média', rateColor: '#eab308' };
    if (rate < 25) return { rateStatus: 'Saudável (Ideal > 20%)', rateColor: '#3b82f6' };
    return { rateStatus: 'Excelente Gerenciamento!', rateColor: 'var(--green-whatsapp)' };
  }, [yearData.savingsRate, yearData.totalIncome]);

  return (
    <div className="p-6 space-y-6 animate-fade pb-32 min-h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Performance Consolidada</h2>
          <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Resumo Anual</h1>
        </div>

        {/* Dynamic Year BADGES */}
        <div className="flex gap-1.5 items-center bg-[var(--surface)] p-1 rounded-2xl border border-[var(--border)] overflow-x-auto max-w-full">
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => {
                setSelectedYear(year);
                setInspectedMonthIndex(null); // Reset month list inspection close
                setComparisonMonthIndex(null);
              }}
              className={`px-3 md:px-4 py-1.5 rounded-xl text-[10px] font-black uppercase italic tracking-wider transition-all cursor-pointer ${
                selectedYear === year
                  ? 'bg-[var(--green-whatsapp)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]/15'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Gráfico de Evolução */}
      <div className="mb-8">
        <ChartNetWorth transactions={transactions} goals={goals} wallets={wallets} />
      </div>

      {/* Totais do Ano - KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Entradas Acumuladas</p>
            <h4 className="text-xl font-black text-[var(--green-whatsapp)]">{format(yearData.totalIncome)}</h4>
            <p className="text-[9px] font-bold text-[var(--text-muted)] mt-1">Média mensal: {format(yearData.avgMonthlyIncome)}</p>
          </div>
          <ArrowUpRight className="w-8 h-8 text-[var(--green-whatsapp)] opacity-60 stroke-[3]" />
        </div>
        <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Saídas Acumuladas</p>
            <h4 className="text-xl font-black text-[#ef4444]">{format(yearData.totalExpense)}</h4>
            <p className="text-[9px] font-bold text-[var(--text-muted)] mt-1">Média mensal: {format(yearData.avgMonthlyExpense)}</p>
          </div>
          <ArrowDownRight className="w-8 h-8 text-[#ef4444] opacity-60 stroke-[3]" />
        </div>
        <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Resultado Líquido</p>
            <h4 className={`text-xl font-black ${yearData.totalBalance >= 0 ? 'text-[var(--text-primary)]' : 'text-red-500'}`}>{format(yearData.totalBalance)}</h4>
            <p className="text-[9px] font-bold text-[var(--text-muted)] mt-1">Acúmulo real de patrimônio</p>
          </div>
          <DollarSign className="w-8 h-8 text-indigo-500 opacity-60 stroke-[3]" />
        </div>
      </div>

      {/* KPIs Secundários de Análise */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Taxa de Poupança */}
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-indigo-500 stroke-[3]" /> Taxa de Poupança
            </p>
            <h4 className="text-lg font-black italic tracking-tighter" style={{ color: rateColor }}>
              {yearData.savingsRate.toFixed(1)}%
            </h4>
            <p className="text-[10px] font-bold text-[var(--text-muted)] mt-0.5">{rateStatus}</p>
          </div>
        </div>

        {/* Mês de Ouro */}
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm flex items-center justify-between">
          {yearData.bestMonth ? (
            <div>
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-yellow-500" /> Mês Destaque
              </p>
              <h4 className="text-base font-black text-[var(--text-primary)] uppercase italic leading-none">{yearData.bestMonth.name}</h4>
              <p className="text-[10px] font-bold text-[var(--green-whatsapp)] mt-1">{format(yearData.bestMonth.balance)} líquido</p>
            </div>
          ) : (
            <div>
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Mês Destaque
              </p>
              <h4 className="text-sm font-black text-[var(--text-muted)] uppercase italic">Sem registros</h4>
            </div>
          )}
        </div>

        {/* Poupado em Metas */}
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-[var(--green-whatsapp)]" /> Reservado em Metas
            </p>
            <h4 className="text-lg font-black text-[var(--green-whatsapp)] italic leading-none">{format(totalGoalsSavedThisYear)}</h4>
            <p className="text-[10px] font-bold text-[var(--text-muted)] mt-1">Aportado para metas este ano</p>
          </div>
        </div>
      </div>

      {/* Categorias mais consumidas no ano consolidado */}
      {yearData.topYearCategories.length > 0 && (
        <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-indigo-500" />
            <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider italic leading-none">Categorias Mais Consumidas no Ano</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {yearData.topYearCategories.slice(0, 6).map((cat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-[var(--text-primary)] uppercase italic text-[11px]">{cat.name}</span>
                  <span className="font-black text-[var(--text-primary)] text-[11px]">
                    {format(cat.amount)} <span className="text-[var(--text-muted)] text-[9px] font-semibold">({cat.percentage.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="w-full bg-[var(--border)]/30 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${cat.percentage}%` }} 
                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                    className="bg-indigo-500 h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Caixa de Inspeção Detalhada do Mês Selecionado */}
      <AnimatePresence mode="wait">
        {inspectedMonthIndex !== null && (
          <motion.div
            key={inspectedMonthIndex}
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--green-whatsapp)]/25 shadow-md relative overflow-hidden"
          >
            <div className="absolute right-0 top-0 w-32 h-32 bg-[var(--green-whatsapp)]/5 rounded-full blur-2xl pointer-events-none" />

            {/* Header com os controles de comparação */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-[var(--border)]/30">
              <div>
                <span className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Detalhes do Período — {selectedYear}
                </span>
                <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter mt-1">
                  Inspeção: {months[inspectedMonthIndex]}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Seleção de Comparação */}
                <div className="flex items-center gap-1 bg-[var(--bg-body)] p-1.5 rounded-2xl border border-[var(--border)]">
                  <span className="text-[9px] font-black uppercase text-[var(--text-muted)] pl-2">Comparar com:</span>
                  <select 
                    value={comparisonMonthIndex !== null ? comparisonMonthIndex : ''} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setComparisonMonthIndex(val !== '' ? Number(val) : null);
                    }}
                    className="bg-transparent text-[11px] font-black uppercase italic tracking-tighter text-[var(--text-primary)] border-none focus:outline-none focus:ring-0 cursor-pointer pr-4"
                  >
                    <option value="" className="bg-[var(--surface)]">Nenhum</option>
                    {months.map((mName, mIdx) => {
                      if (mIdx === inspectedMonthIndex) return null;
                      const hasD = yearData.monthly[mIdx].hasData;
                      return (
                        <option key={mIdx} value={mIdx} className="bg-[var(--surface)] text-[var(--text-primary)]">
                          {mName} {hasD ? '' : '(Vazio)'}
                        </option>
                      );
                    })}
                  </select>
                  {comparisonMonthIndex !== null && (
                    <button 
                      onClick={() => setComparisonMonthIndex(null)}
                      className="p-1 hover:bg-[var(--border)]/30 rounded-lg text-red-500 transition-all cursor-pointer mr-1"
                      title="Limpar comparação"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setInspectedMonthIndex(null);
                    setComparisonMonthIndex(null);
                  }}
                  className="w-8 h-8 rounded-xl hover:bg-[var(--border)]/30 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none transition-all active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {comparisonMonthIndex !== null ? (
              /* MODO COMPARATIVO ATIVADO (SIDE-BY-SIDE) */
              <div className="space-y-6">
                {/* Visualização de KPIs Comparativos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Comparação de Entradas */}
                  <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border)]/60">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Comparativo Entradas</span>
                      <ArrowUpRight className="w-4 h-4 text-[var(--green-whatsapp)]" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{months[inspectedMonthIndex]}:</span>
                        <span className="font-extrabold text-[var(--green-whatsapp)]">{format(yearData.monthly[inspectedMonthIndex].income)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{months[comparisonMonthIndex]}:</span>
                        <span className="font-extrabold text-indigo-400">{format(yearData.monthly[comparisonMonthIndex].income)}</span>
                      </div>
                      <div className="pt-2 border-t border-[var(--border)]/30 flex justify-between text-[10px] font-bold">
                        <span className="text-[var(--text-muted)]">Diferença:</span>
                        {(() => {
                          const diff = yearData.monthly[inspectedMonthIndex].income - yearData.monthly[comparisonMonthIndex].income;
                          return (
                            <span className={diff >= 0 ? 'text-[var(--green-whatsapp)]' : 'text-[#ef4444]'}>
                              {diff >= 0 ? '+' : ''}{format(diff)}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Comparação de Saídas */}
                  <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border)]/60">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Comparativo Saídas</span>
                      <ArrowDownRight className="w-4 h-4 text-[#ef4444]" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{months[inspectedMonthIndex]}:</span>
                        <span className="font-extrabold text-[#ef4444]">{format(yearData.monthly[inspectedMonthIndex].expense)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{months[comparisonMonthIndex]}:</span>
                        <span className="font-extrabold text-amber-500">{format(yearData.monthly[comparisonMonthIndex].expense)}</span>
                      </div>
                      <div className="pt-2 border-t border-[var(--border)]/30 flex justify-between text-[10px] font-bold">
                        <span className="text-[var(--text-muted)]">Diferença:</span>
                        {(() => {
                          const diff = yearData.monthly[inspectedMonthIndex].expense - yearData.monthly[comparisonMonthIndex].expense;
                          // Gastar menos no mês inspecionado do que no mês de comparação é bom (verde)
                          return (
                            <span className={diff <= 0 ? 'text-[var(--green-whatsapp)]' : 'text-[#ef4444]'}>
                              {diff > 0 ? '+' : ''}{format(diff)} ({diff <= 0 ? 'economia' : 'acréscimo'})
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Comparação de Saldo Líquido */}
                  <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border)]/60">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Comparativo Saldo</span>
                      <DollarSign className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{months[inspectedMonthIndex]}:</span>
                        <span className={`font-extrabold ${yearData.monthly[inspectedMonthIndex].balance >= 0 ? 'text-[var(--green-whatsapp)]' : 'text-red-500'}`}>
                          {format(yearData.monthly[inspectedMonthIndex].balance)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{months[comparisonMonthIndex]}:</span>
                        <span className={`font-extrabold ${yearData.monthly[comparisonMonthIndex].balance >= 0 ? 'text-indigo-400' : 'text-[#ef4444]'}`}>
                          {format(yearData.monthly[comparisonMonthIndex].balance)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[var(--border)]/30 flex justify-between text-[10px] font-bold">
                        <span className="text-[var(--text-muted)]">Diferencial:</span>
                        {(() => {
                          const diff = yearData.monthly[inspectedMonthIndex].balance - yearData.monthly[comparisonMonthIndex].balance;
                          return (
                            <span className={diff >= 0 ? 'text-[var(--green-whatsapp)]' : 'text-[#ef4444]'}>
                              {diff >= 0 ? '+' : ''}{format(diff)}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comparação Direta de Categorias */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <PieChart className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider italic">
                      Gasto Detalhado de Todas as Categorias ({months[inspectedMonthIndex]} vs {months[comparisonMonthIndex]})
                    </h4>
                  </div>

                  {comparisonData && comparisonData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {comparisonData.map((cat, ci) => {
                        const maxVal = Math.max(cat.amountA, cat.amountB);
                        const pctA = maxVal > 0 ? (cat.amountA / maxVal) * 100 : 0;
                        const pctB = maxVal > 0 ? (cat.amountB / maxVal) * 100 : 0;

                        return (
                          <div key={ci} className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)]/50 space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="font-extrabold text-[var(--text-primary)] uppercase italic text-[11px]">
                                {cat.name}
                              </span>
                              <div>
                                {cat.diff !== 0 ? (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.diff > 0 ? 'bg-red-500/10 text-[#ef4444]' : 'bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)]'}`}>
                                    {cat.diff > 0 ? '+' : ''}{format(cat.diff)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--border)]/40 px-2 py-0.5 rounded-full">
                                    Inalterado
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-[var(--text-muted)] truncate">{months[inspectedMonthIndex]}</span>
                                  <span className="font-black text-[var(--text-primary)]">{format(cat.amountA)}</span>
                                </div>
                                <div className="w-full bg-[var(--border)]/30 h-1.5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pctA}%` }}
                                    transition={{ duration: 0.5 }}
                                    className="bg-[var(--green-whatsapp)] h-full rounded-full"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-[var(--text-muted)] truncate">{months[comparisonMonthIndex]}</span>
                                  <span className="font-black text-[var(--text-primary)]">{format(cat.amountB)}</span>
                                </div>
                                <div className="w-full bg-[var(--border)]/30 h-1.5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pctB}%` }}
                                    transition={{ duration: 0.5 }}
                                    className="bg-indigo-500 h-full rounded-full"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)] uppercase italic font-bold">Sem despesas mapeadas para comparação nestes meses.</p>
                  )}
                </div>
              </div>
            ) : (
              /* MODO ÚNICO — VISUALIZAR UM MÊS COM TODAS AS CATEGORIAS */
              <div>
                {/* Balanço rápido do mês selecionado */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border)]/60 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Entradas</span>
                      <p className="text-md font-black text-[var(--green-whatsapp)]">{format(yearData.monthly[inspectedMonthIndex].income)}</p>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-[var(--green-whatsapp)] stroke-[3]" />
                  </div>
                  <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border)]/60 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Saídas</span>
                      <p className="text-md font-black text-[#ef4444]">{format(yearData.monthly[inspectedMonthIndex].expense)}</p>
                    </div>
                    <ArrowDownRight className="w-5 h-5 text-[#ef4444] stroke-[3]" />
                  </div>
                  <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border)]/60 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Resultado Líquido</span>
                      <p className={`text-md font-black ${yearData.monthly[inspectedMonthIndex].balance >= 0 ? 'text-[var(--text-primary)]' : 'text-red-500'}`}>
                        {format(yearData.monthly[inspectedMonthIndex].balance)}
                      </p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${yearData.monthly[inspectedMonthIndex].balance >= 0 ? 'bg-[var(--green-whatsapp)]' : 'bg-red-500'}`} />
                  </div>
                </div>

                {/* Categorias e Maiores Transações do Mês */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Categorias do mês (Mostra TODAS em vez de fatiar) */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider italic">Distribuição de Saídas</h4>
                    {yearData.monthly[inspectedMonthIndex].topCategories.length > 0 ? (
                      <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                        {yearData.monthly[inspectedMonthIndex].topCategories.map((cat, ci) => {
                          const totalMonthExpense = yearData.monthly[inspectedMonthIndex].expense;
                          const pct = totalMonthExpense > 0 ? (cat.amount / totalMonthExpense) * 100 : 0;
                          return (
                            <div key={ci} className="space-y-1">
                              <div className="flex justify-between text-xs font-bold">
                                <span className="text-[11px] text-[var(--text-primary)] uppercase italic">{cat.name}</span>
                                <span className="text-[11px] text-[var(--text-primary)]">
                                  {format(cat.amount)} <span className="text-[9px] text-[var(--text-muted)]">({pct.toFixed(1)}%)</span>
                                </span>
                              </div>
                              <div className="w-full bg-[var(--border)]/30 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--text-muted)] uppercase italic font-bold">Nenhum gasto mapeado neste mês.</p>
                    )}
                  </div>

                  {/* Maiores Transações do mês */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider italic">Maiores Movimentações</h4>
                    {yearData.monthly[inspectedMonthIndex].transactions.length > 0 ? (
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                        {yearData.monthly[inspectedMonthIndex].transactions
                          .slice()
                          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                          .slice(0, 5)
                          .map((t, ti) => (
                            <div key={ti} className="flex justify-between items-center p-2.5 bg-[var(--bg-body)] rounded-xl border border-[var(--border)]/40 hover:border-indigo-500/10 transition-all text-xs">
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="font-extrabold text-[var(--text-primary)] truncate uppercase tracking-tight">{t.description}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-[var(--text-muted)] font-black uppercase">
                                  <span className="italic text-indigo-500">{t.category || 'Outros'}</span>
                                  <span>•</span>
                                  <span>{parseSafeDate(t.date).toLocaleDateString('pt-BR')}</span>
                                </div>
                              </div>
                              <span className={`font-black tracking-tight shrink-0 ${t.type === 'INCOME' ? 'text-[var(--green-whatsapp)]' : 'text-[#ef4444]'}`}>
                                {t.type === 'INCOME' ? '+' : '-'}{format(t.amount)}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--text-muted)] uppercase italic font-bold">Nenhuma transação anotada.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <div className="mb-4">
          <h3 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-[0.2em] italic mb-1">Mapeamento Mensal</h3>
          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Clique sobre um mês para ver a análise profunda de gastos e lançamentos</p>
        </div>

        {/* Grid de 12 Meses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {yearData.monthly.map((m, idx) => {
            const isInspected = inspectedMonthIndex === idx;
            return (
              <div 
                key={idx} 
                onClick={() => {
                  if (isInspected) {
                    setInspectedMonthIndex(null);
                    setComparisonMonthIndex(null);
                  } else {
                    setInspectedMonthIndex(idx);
                    setComparisonMonthIndex(null);
                  }
                }}
                className={`bg-[var(--surface)] p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group select-none ${
                  m.hasData 
                    ? isInspected
                      ? 'border-[var(--green-whatsapp)] shadow-md bg-[var(--green-whatsapp)]/[0.02]' 
                      : 'border-[var(--border)] shadow-sm hover:border-[var(--green-whatsapp)]/40 hover:-translate-y-0.5' 
                    : 'border-dashed border-[var(--border)] opacity-40 hover:opacity-70'
                }`}
              >
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-xs font-black uppercase italic ${isInspected ? 'text-[var(--green-whatsapp)]' : 'text-[var(--text-primary)]'}`}>
                    {m.name}
                  </span>
                  {m.hasData ? (
                    <div className={`w-2.5 h-2.5 rounded-full ${m.balance >= 0 ? 'bg-[var(--green-whatsapp)]' : 'bg-red-500'}`} />
                  ) : (
                    <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">Bruto</span>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-[var(--text-muted)] uppercase">Entradas</span>
                    <span className="text-[var(--green-whatsapp)]">{format(m.income)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-[var(--text-muted)] uppercase">Saídas</span>
                    <span className="text-[#ef4444]">{format(m.expense)}</span>
                  </div>
                  <div className="pt-2 border-t border-[var(--border)]/30 flex justify-between items-center">
                    <span className="text-[9px] font-black text-[var(--text-primary)] uppercase">Saldo</span>
                    <span className={`text-sm font-black tracking-tight ${m.balance >= 0 ? 'text-[var(--text-primary)]' : 'text-[#ef4444]'}`}>
                      {format(m.balance)}
                    </span>
                  </div>

                  {/* Proporcional do Fluxo de Caixa (Entrada vs Saída) */}
                  {m.hasData && (m.income > 0 || m.expense > 0) && (
                    <div className="w-full bg-[var(--border)]/20 h-1 rounded-full overflow-hidden flex mt-2.5">
                      <div 
                        className="bg-[var(--green-whatsapp)] h-full" 
                        style={{ width: `${(m.income / (m.income + m.expense)) * 100}%` }} 
                      />
                      <div 
                        className="bg-[#ef4444] h-full" 
                        style={{ width: `${(m.expense / (m.income + m.expense)) * 100}%` }} 
                      />
                    </div>
                  )}
                </div>

                {/* Seta discreta de hover */}
                {m.hasData && (
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all text-[var(--green-whatsapp)]">
                    <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default YearlySummary;

