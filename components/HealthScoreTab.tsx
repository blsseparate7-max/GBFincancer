
import React, { useMemo } from 'react';
import { Transaction } from '../types';

interface HealthScoreTabProps {
  transactions: Transaction[];
}

const HealthScoreTab: React.FC<HealthScoreTabProps> = ({ transactions = [] }) => {
  const scoreData = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    
    // 1. Savings Rate (Ideal > 20%)
    const sobra = income - expense;
    const savingsRate = income > 0 ? (sobra / income) * 100 : 0;
    
    // 2. Fixed Cost Ratio (Ideal < 50%)
    // We'll assume categories like MORADIA, EDUCAÇÃO, SAÚDE are fixed for this simple model
    const fixedCategories = ['MORADIA', 'EDUCAÇÃO', 'SAÚDE', 'INTERNET', 'LUZ', 'AGUA'];
    const fixedExpenses = transactions
      .filter(t => t.type === 'EXPENSE' && fixedCategories.includes(t.category?.toUpperCase() || ''))
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const fixedRatio = income > 0 ? (fixedExpenses / income) * 100 : 0;

    // Calculate Score (0-1000)
    let score = 0;
    
    // Savings Rate contribution (max 500 points)
    if (savingsRate >= 30) score += 500;
    else if (savingsRate >= 20) score += 400;
    else if (savingsRate >= 10) score += 250;
    else if (savingsRate > 0) score += 100;

    // Fixed Ratio contribution (max 500 points)
    if (fixedRatio <= 30) score += 500;
    else if (fixedRatio <= 50) score += 400;
    else if (fixedRatio <= 70) score += 200;
    else score += 50;

    // Penalties
    if (sobra < 0) score = Math.max(100, score - 300);

    return { 
      score, 
      savingsRate, 
      fixedRatio,
      status: score > 800 ? 'Excelente' : score > 500 ? 'Bom' : 'Crítico',
      capacity: savingsRate > 20 ? 'Alta' : savingsRate > 5 ? 'Média' : 'Baixa',
      risk: fixedRatio > 70 || sobra < 0 ? 'Alto' : fixedRatio > 50 ? 'Moderado' : 'Baixo'
    };
  }, [transactions]);

  return (
    <div className="p-6 space-y-6 animate-fade">
      <header className="mb-8">
        <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">IA Financeira</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Health Score</h1>
      </header>

      <div className="bg-white p-12 rounded-[2.5rem] border border-[var(--border)] shadow-sm flex flex-col items-center text-center">
        <div className="text-7xl font-black text-[var(--text-primary)] mb-2">{scoreData.score}</div>
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${scoreData.score > 700 ? 'bg-[#d9fdd3] text-[#008069]' : scoreData.score > 400 ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'}`}>
          Saúde {scoreData.status}
        </span>
        <p className="mt-8 text-sm text-[var(--text-muted)] leading-relaxed max-w-xs">
          Sua taxa de poupança atual é de <span className="font-bold text-[var(--text-primary)]">{scoreData.savingsRate.toFixed(1)}%</span>. 
          Seus custos fixos consomem <span className="font-bold text-[var(--text-primary)]">{scoreData.fixedRatio.toFixed(1)}%</span> da sua renda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Capacidade de Poupança</p>
          <h4 className={`text-xl font-black ${scoreData.capacity === 'Alta' ? 'text-[var(--green-whatsapp)]' : scoreData.capacity === 'Média' ? 'text-amber-500' : 'text-red-500'}`}>{scoreData.capacity}</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Risco de Inadimplência</p>
          <h4 className={`text-xl font-black ${scoreData.risk === 'Baixo' ? 'text-[var(--green-whatsapp)]' : scoreData.risk === 'Moderado' ? 'text-amber-500' : 'text-red-500'}`}>{scoreData.risk}</h4>
        </div>
      </div>
    </div>
  );
};

export default HealthScoreTab;
