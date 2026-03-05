import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { calculateWeeklySummary, formatCurrency } from '../services/summaryService';
import { motion } from 'motion/react';

interface InsightsProps {
  transactions: Transaction[];
}

const Insights: React.FC<InsightsProps> = ({ transactions }) => {
  const summary = useMemo(() => calculateWeeklySummary(transactions), [transactions]);

  const topCategory = summary.topCategories[0];

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black italic text-[var(--green-whatsapp)] tracking-tighter">INSIGHTS</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Análise Semanal Inteligente</p>
        </div>
        <div className="w-10 h-10 bg-[var(--green-whatsapp)]/10 rounded-full flex items-center justify-center text-xl">💡</div>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">📅</div>
        
        <div className="relative z-10">
          <h3 className="text-lg font-black italic text-[var(--text-primary)] mb-1">Resumo da Semana</h3>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-6">Últimos 7 dias de movimentação</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-black/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Entradas</p>
              <p className="text-xl font-black text-[var(--green-whatsapp)]">{formatCurrency(summary.income)}</p>
            </div>
            <div className="bg-black/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Saídas</p>
              <p className="text-xl font-black text-red-500">{formatCurrency(summary.expense)}</p>
            </div>
            <div className="bg-black/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Sobra</p>
              <p className={`text-xl font-black ${summary.balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                {formatCurrency(summary.balance)}
              </p>
            </div>
          </div>

          {topCategory ? (
            <div className="bg-[var(--green-whatsapp)]/5 border border-[var(--green-whatsapp)]/20 p-5 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--green-whatsapp)]">Maior Gasto</p>
                  <p className="text-lg font-black text-[var(--text-primary)]">{topCategory.category}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)] font-medium">
                Você gastou <span className="text-[var(--text-primary)] font-bold">{formatCurrency(topCategory.amount)}</span> nesta categoria nos últimos 7 dias.
              </p>
            </div>
          ) : (
            <div className="text-center py-6 text-[var(--text-muted)] italic text-sm">
              Nenhum gasto registrado nos últimos 7 dias.
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summary.topCategories.slice(1).map((cat, idx) => (
          <div key={idx} className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{cat.category}</p>
              <p className="font-bold">{formatCurrency(cat.amount)}</p>
            </div>
            <div className="w-8 h-8 bg-black/5 rounded-full flex items-center justify-center text-xs font-black">
              #{idx + 2}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex gap-4 items-start">
        <span className="text-2xl">💡</span>
        <div>
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Dica do Mentor</p>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {summary.balance > 0 
              ? `Parabéns! Você sobrou ${formatCurrency(summary.balance)} esta semana. Que tal investir uma parte desse valor em suas metas?`
              : `Atenção! Suas saídas superaram as entradas em ${formatCurrency(Math.abs(summary.balance))}. Revise seus gastos em ${topCategory?.category || 'categorias principais'}.`
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default Insights;
