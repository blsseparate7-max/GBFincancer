
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';

interface ImpactSimulatorProps {
  transactions: Transaction[];
}

const ImpactSimulator: React.FC<ImpactSimulatorProps> = ({ transactions = [] }) => {
  const [val, setVal] = useState('');
  
  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const sobra = income - expense;
    return { income, expense, sobra };
  }, [transactions]);

  const stressLevel = useMemo(() => {
    const v = parseFloat(val) || 0;
    if (v === 0) return { level: 'Paz Total', color: '#00a884', desc: 'Sua mente está tranquila. Nenhuma compra planejada.' };
    
    const impactPct = stats.sobra > 0 ? (v / stats.sobra) * 100 : 100;

    if (impactPct < 10) return { level: 'Irrelevante', color: '#00a884', desc: 'Esta compra cabe folgadamente na sua sobra mensal.' };
    if (impactPct < 30) return { level: 'Moderado', color: '#f59e0b', desc: 'Uma compra que exige atenção, mas não compromete o mês.' };
    if (impactPct < 60) return { level: 'Impacto Alto', color: '#f97316', desc: 'Atenção! Isso vai consumir mais da metade da sua sobra mensal.' };
    return { level: 'Crítico', color: '#ef4444', desc: 'Perigo! Esta compra excede sua capacidade financeira atual ou consome quase toda a sobra.' };
  }, [val, stats]);

  return (
    <div className="p-6 space-y-6 animate-fade">
      <header className="mb-8">
        <h2 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.4em] mb-1">Paz Financeira</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Stress Test</h1>
      </header>

      <div className="bg-[var(--surface)] p-8 rounded-[2rem] border border-[var(--border)] shadow-sm">
        <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">Simular Compra Inesperada</h4>
        <div className="relative mb-4">
           <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-black">R$</span>
           <input 
            className="w-full bg-[var(--bg-body)] border border-transparent rounded-2xl p-6 pl-14 text-2xl font-black text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)] transition-all"
            placeholder="0,00"
            value={val}
            onChange={e => setVal(e.target.value)}
           />
        </div>
        <p className="text-[10px] text-[var(--text-muted)] font-bold text-center uppercase tracking-widest italic">O GB avalia o risco com base na sua sobra de R$ {stats.sobra.toFixed(2)}</p>
      </div>

      <div className="bg-[var(--surface)] p-10 rounded-3xl border border-[var(--border)] text-center shadow-lg">
        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Nível de Estresse Financeiro</p>
        <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-4" style={{ color: stressLevel.color }}>{stressLevel.level}</h3>
        <p className="text-sm font-medium text-[var(--text-muted)] leading-relaxed px-6 italic">{stressLevel.desc}</p>
      </div>
    </div>
  );
};

export default ImpactSimulator;
