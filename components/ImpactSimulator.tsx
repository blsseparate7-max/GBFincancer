
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';

interface ImpactSimulatorProps {
  transactions: Transaction[];
}

const ImpactSimulator: React.FC<ImpactSimulatorProps> = () => {
  const [val, setVal] = useState('');
  
  const stressLevel = useMemo(() => {
    const v = parseFloat(val) || 0;
    if (v === 0) return { level: 'Paz Total', color: '#00a884', desc: 'Sua mente está tranquila. Nenhuma compra planejada.' };
    if (v < 500) return { level: 'Moderado', color: '#f59e0b', desc: 'Uma compra pequena, mas exige atenção ao saldo da semana.' };
    return { level: 'Impacto Alto', color: '#ef4444', desc: 'Atenção! Esta compra pode comprometer sua paz financeira do mês.' };
  }, [val]);

  return (
    <div className="p-6 space-y-6 animate-fade">
      <header className="mb-8">
        <h2 className="text-[10px] font-black text-[#ef4444] uppercase tracking-[0.4em] mb-1">Paz Financeira</h2>
        <h1 className="text-3xl font-black text-[#111b21] uppercase italic tracking-tighter">Stress Test</h1>
      </header>

      <div className="bg-white p-8 rounded-[2rem] border border-[#d1d7db] shadow-sm">
        <h4 className="text-[10px] font-black text-[#667781] uppercase tracking-widest mb-4">Simular Compra Inesperada</h4>
        <div className="relative mb-4">
           <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[#667781] font-black">R$</span>
           <input 
            className="w-full bg-[#f0f2f5] border border-transparent rounded-2xl p-6 pl-14 text-2xl font-black text-[#111b21] outline-none focus:border-[#00a884] transition-all"
            placeholder="0,00"
            value={val}
            onChange={e => setVal(e.target.value)}
           />
        </div>
        <p className="text-[10px] text-[#667781] font-bold text-center uppercase tracking-widest italic">O GB avalia o risco imediato para você</p>
      </div>

      <div className="bg-white p-10 rounded-3xl border border-[#d1d7db] text-center shadow-lg">
        <p className="text-[9px] font-black text-[#667781] uppercase mb-1">Nível de Estresse Financeiro</p>
        <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-4" style={{ color: stressLevel.color }}>{stressLevel.level}</h3>
        <p className="text-sm font-medium text-[#667781] leading-relaxed px-6 italic">{stressLevel.desc}</p>
      </div>
    </div>
  );
};

export default ImpactSimulator;
