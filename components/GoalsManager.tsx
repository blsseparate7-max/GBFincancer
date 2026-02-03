
import React, { useState } from 'react';
import { SavingGoal } from '../types';

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
    onAdd({
      id: Math.random().toString(36),
      name,
      targetAmount: Number(target),
      currentAmount: 0
    });
    setName('');
    setTarget('');
    setShowAdd(false);
  };

  const currency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 h-full overflow-y-auto no-scrollbar pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-900 tracking-tighter italic uppercase">Minhas Metas</h2>
        <button 
          onClick={() => setShowAdd(true)}
          className="w-10 h-10 bg-[#075e54] text-white rounded-full flex items-center justify-center shadow-lg font-bold"
        >
          +
        </button>
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 mb-6 space-y-4 animate-in slide-in-from-top">
          <input className="w-full bg-gray-50 rounded-xl p-3 text-sm font-bold" placeholder="Nome da Meta (ex: Viagem)" value={name} onChange={e => setName(e.target.value)} />
          <input className="w-full bg-gray-50 rounded-xl p-3 text-sm font-bold" type="number" placeholder="Valor Alvo R$" value={target} onChange={e => setTarget(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 bg-[#075e54] text-white py-3 rounded-xl font-black text-xs uppercase">Salvar</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black text-xs uppercase">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {goals.map(g => {
          const progress = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
          return (
            <div key={g.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h4 className="font-black text-gray-800 uppercase italic leading-none">{g.name}</h4>
                  <p className="text-[10px] text-gray-400 font-black mt-1 uppercase tracking-widest">Objetivo: {currency(g.targetAmount)}</p>
                </div>
                <span className="text-xs font-black text-[#075e54]">{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && !showAdd && (
          <div className="text-center py-20 opacity-30 italic">Nenhuma meta ativa. Que tal planejar algo?</div>
        )}
      </div>
    </div>
  );
};

export default GoalsManager;
