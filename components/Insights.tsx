import React, { useMemo } from 'react';
import { Transaction, CategoryLimit } from '../types';
import { calculateMonthlySummary, formatCurrency } from '../services/summaryService';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Compass, ShieldCheck, AlertTriangle, Target } from 'lucide-react';

interface InsightsProps {
  transactions: Transaction[];
  limits: CategoryLimit[];
}

const Insights: React.FC<InsightsProps> = ({ transactions, limits }) => {
  const summary = useMemo(() => calculateMonthlySummary(transactions), [transactions]);

  const { situation, villain, bestPoint, recommendation } = useMemo(() => {
    const income = summary.income;
    const expense = summary.expense;
    const balance = summary.balance;
    const categories = summary.categories;

    // 1. Situação Atual
    let situation = {
      label: "Seu momento financeiro está controlado",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      icon: <ShieldCheck className="text-blue-500" size={24} />
    };

    if (balance <= 0) {
      situation = {
        label: "Seu momento financeiro está apertado",
        color: "text-rose-500",
        bg: "bg-rose-500/10",
        icon: <AlertTriangle className="text-rose-500" size={24} />
      };
    } else if (income > 0 && balance > income * 0.2) {
      situation = {
        label: "Seu momento financeiro está saudável",
        color: "text-[var(--green-whatsapp)]",
        bg: "bg-[var(--green-whatsapp)]/10",
        icon: <TrendingUp className="text-[var(--green-whatsapp)]" size={24} />
      };
    }

    // 2. Maior Vilão
    const villain = categories.length > 0 ? categories[0] : null;

    // 3. Melhor Ponto (Menor gasto que não seja zero, ou o que está mais longe do limite)
    let bestPoint = null;
    if (categories.length > 1) {
      // Se houver limites, procurar o que tem menor % de uso
      const limitsWithSpent = limits.filter(l => l.isActive && l.limit > 0);
      if (limitsWithSpent.length > 0) {
        const sortedByUsage = [...limitsWithSpent].sort((a, b) => (a.spent / a.limit) - (b.spent / b.limit));
        const bestLimit = sortedByUsage[0];
        const catData = categories.find(c => c.category.toUpperCase() === bestLimit.category.toUpperCase());
        bestPoint = {
          category: bestLimit.category,
          amount: catData?.amount || bestLimit.spent,
          percentage: catData?.percentage || (expense > 0 ? (bestLimit.spent / expense) * 100 : 0)
        };
      } else {
        // Se não houver limites, pegar o menor gasto relevante (último da lista)
        bestPoint = categories[categories.length - 1];
      }
    }

    // 4. Caminho Recomendado
    let recommendation = "Continue acompanhando seus gastos para manter o controle.";
    if (balance <= 0 && villain) {
      recommendation = `Seu foco agora deve ser controlar a categoria ${villain.category}. Reduzir gastos aqui é essencial para sair do vermelho.`;
    } else if (balance > 0 && balance < income * 0.1 && villain) {
      recommendation = `Se você reduzir um pouco os gastos em ${villain.category}, sua sobra no final do mês será muito mais confortável.`;
    } else if (balance >= income * 0.1) {
      recommendation = "Você está com uma boa sobra! O caminho agora é separar parte desse valor para seus objetivos ou reserva de emergência.";
    }

    return { situation, villain, bestPoint, recommendation };
  }, [summary, limits]);

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto pb-20 min-h-full">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black italic text-[var(--green-whatsapp)] tracking-tighter">CAMINHO FINANCEIRO</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Direção e Estratégia Mensal</p>
        </div>
        <div className="w-10 h-10 bg-[var(--green-whatsapp)]/10 rounded-full flex items-center justify-center text-xl">
          <Compass className="text-[var(--green-whatsapp)]" size={24} />
        </div>
      </header>

      {/* 1. Situação Atual */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${situation.bg} border border-[var(--border)] rounded-[2.5rem] p-8 shadow-sm flex items-center gap-6`}
      >
        <div className="shrink-0 w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner">
          {situation.icon}
        </div>
        <div>
          <h3 className={`text-xl font-black italic ${situation.color} leading-tight`}>
            {situation.label}
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">
            Baseado no seu balanço de {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 2. Maior Vilão */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-6 shadow-sm relative overflow-hidden"
        >
          <div className="absolute -top-4 -right-4 opacity-5 text-8xl">📉</div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-rose-500" size={18} />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Maior Vilão</h4>
            </div>
            {villain ? (
              <>
                <p className="text-2xl font-black text-[var(--text-primary)] mb-1">{villain.category}</p>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-lg font-bold text-rose-500">{formatCurrency(villain.amount)}</span>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] mb-1">({villain.percentage.toFixed(1)}% das despesas)</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                  Essa é a categoria que mais está consumindo seu orçamento este mês.
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)] italic">Nenhum gasto registrado.</p>
            )}
          </div>
        </motion.div>

        {/* 3. Melhor Economia */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-6 shadow-sm relative overflow-hidden"
        >
          <div className="absolute -top-4 -right-4 opacity-5 text-8xl">📈</div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="text-[var(--green-whatsapp)]" size={18} />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Melhor Ponto</h4>
            </div>
            {bestPoint ? (
              <>
                <p className="text-2xl font-black text-[var(--text-primary)] mb-1">{bestPoint.category}</p>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-lg font-bold text-[var(--green-whatsapp)]">{formatCurrency(bestPoint.amount)}</span>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] mb-1">({bestPoint.percentage.toFixed(1)}% das despesas)</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                  Aqui está o ponto mais saudável do seu mês. Continue assim!
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--text-muted)] italic">Nenhum gasto registrado.</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* 4. Caminho Recomendado */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Target className="text-[var(--green-whatsapp)]" size={80} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[var(--green-whatsapp)]/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-[var(--green-whatsapp)]" size={18} />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--green-whatsapp)]">Caminho Recomendado</h4>
          </div>
          <p className="text-lg font-medium text-[var(--text-primary)] leading-snug">
            "{recommendation}"
          </p>
          <div className="mt-6 pt-6 border-t border-[var(--border)] flex items-center justify-between">
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase">Entradas</p>
                <p className="text-sm font-black text-[var(--text-primary)]">{formatCurrency(summary.income)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase">Saídas</p>
                <p className="text-sm font-black text-[var(--text-primary)]">{formatCurrency(summary.expense)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase">Sobra Atual</p>
              <p className={`text-lg font-black ${summary.balance >= 0 ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
                {formatCurrency(summary.balance)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Insights;
