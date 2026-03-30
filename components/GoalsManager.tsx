
import React, { useState } from 'react';
import { SavingGoal } from '../types';
import MoneyInput from './MoneyInput';

interface Props {
  goals: SavingGoal[];
  onAdd: (goal: SavingGoal) => void;
}

const GoalsManager: React.FC<Props> = ({ goals, onAdd }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');

  const handleAdd = () => {
    if (!name || !target) return;
    // Fix para o erro de tipagem: adicionando propriedades obrigatórias da interface SavingGoal
    onAdd({
      id: Math.random().toString(36),
      name,
      targetAmount: Number(target),
      currentAmount: 0,
      location: 'Geral',
      type: 'CUSTOM',
      deadlineMonths: 12,
      updatedAt: new Date()
    });
    setName('');
    setTarget('');
    setShowAdd(false);
  };

  const currency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 min-h-full pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tighter italic uppercase">Minhas Metas</h2>
        <button 
          onClick={() => setShowAdd(true)}
          className="w-10 h-10 bg-[var(--green-whatsapp)] text-white rounded-full flex items-center justify-center shadow-lg font-bold"
        >
          +
        </button>
      </div>

      {showAdd && (
        <div className="bg-[var(--surface)] p-6 rounded-3xl shadow-xl border border-[var(--border)] mb-6 space-y-4 animate-in slide-in-from-top">
          <input className="w-full bg-[var(--bg-body)] rounded-xl p-3 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" placeholder="Nome da Meta (ex: Viagem)" value={name} onChange={e => setName(e.target.value)} />
          <MoneyInput 
            className="w-full bg-[var(--bg-body)] rounded-xl p-3 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
            placeholder="Valor Alvo R$" 
            value={Number(target) || 0} 
            onChange={val => setTarget(val.toString())} 
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 bg-[var(--green-whatsapp)] text-white py-3 rounded-xl font-black text-xs uppercase">Salvar</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 bg-[var(--bg-body)] text-[var(--text-muted)] py-3 rounded-xl font-black text-xs uppercase border border-[var(--border)]">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {goals.map(g => {
          const progress = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
          return (
            <div key={g.id} className="bg-[var(--surface)] p-6 rounded-[2rem] shadow-sm border border-[var(--border)]">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h4 className="font-black text-[var(--text-primary)] uppercase italic leading-none">{g.name}</h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-black mt-1 uppercase tracking-widest">Objetivo: {currency(g.targetAmount)}</p>
                </div>
                <span className="text-xs font-black text-[var(--green-whatsapp)]">{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full h-3 bg-[var(--bg-body)] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && !showAdd && (
          <div className="text-center py-20 opacity-30 italic text-[var(--text-muted)]">Nenhuma meta ativa. Que tal planejar algo?</div>
        )}
      </div>
    </div>
  );
};

export default GoalsManager;
