
import React, { useMemo } from 'react';
import { Transaction } from '../types';

interface HealthScoreTabProps {
  transactions: Transaction[];
}

const HealthScoreTab: React.FC<HealthScoreTabProps> = ({ transactions = [] }) => {
  const scoreData = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const sobraPct = income > 0 ? ((income - expense) / income) * 100 : 0;
    
    let score = 0;
    if (sobraPct >= 30) score = 95;
    else if (sobraPct >= 20) score = 80;
    else if (sobraPct >= 10) score = 65;
    else score = 40;

    return { score, sobraPct, status: score > 70 ? 'Excelente' : score > 40 ? 'Bom' : 'Crítico' };
  }, [transactions]);

  return (
    <div className="p-6 space-y-6 animate-fade">
      <header className="mb-8">
        <h2 className="text-[10px] font-black text-[#00a884] uppercase tracking-[0.4em] mb-1">IA Financeira</h2>
        <h1 className="text-3xl font-black text-[#111b21] uppercase italic tracking-tighter">Health Score</h1>
      </header>

      <div className="bg-white p-12 rounded-[2.5rem] border border-[#d1d7db] shadow-sm flex flex-col items-center text-center">
        <div className="text-7xl font-black text-[#111b21] mb-2">{scoreData.score}</div>
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${scoreData.score > 70 ? 'bg-[#d9fdd3] text-[#008069]' : 'bg-amber-50 text-amber-500'}`}>
          Saúde {scoreData.status}
        </span>
        <p className="mt-8 text-sm text-[#667781] leading-relaxed max-w-xs">
          Com base no seu histórico de entradas e saídas, você mantém uma reserva de <span className="font-bold text-[#111b21]">{scoreData.sobraPct.toFixed(1)}%</span> da sua renda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-[#d1d7db] shadow-sm">
          <p className="text-[9px] font-black text-[#667781] uppercase mb-1">Capacidade de Poupança</p>
          <h4 className="text-xl font-black text-[#00a884]">Alta</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-[#d1d7db] shadow-sm">
          <p className="text-[9px] font-black text-[#667781] uppercase mb-1">Risco de Inadimplência</p>
          <h4 className="text-xl font-black text-[#ef4444]">Mínimo</h4>
        </div>
      </div>
    </div>
  );
};

export default HealthScoreTab;
