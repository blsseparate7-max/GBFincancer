
import React, { useState } from 'react';
import { SavingGoal } from '../types';
import { getGoalAdvice } from '../services/geminiService';

interface GoalsProps {
  goals: SavingGoal[];
  onAddGoal: (goal: Omit<SavingGoal, 'id' | 'createdAt' | 'currentAmount' | 'advice'>) => void;
}

const Goals: React.FC<GoalsProps> = ({ goals, onAddGoal }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', target: '', monthly: '' });

  const calculateEstimates = (goal: SavingGoal) => {
    const remaining = goal.targetAmount - goal.currentAmount;
    if (remaining <= 0) return 'Concluída!';
    const months = Math.ceil(remaining / (goal.monthlySaving || 1));
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-4 h-full overflow-y-auto bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-gray-800 tracking-tight">Suas Metas</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-emerald-600 text-white p-2 rounded-full shadow-lg active:scale-90 transition-transform"
        >
          {isAdding ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-4 rounded-2xl shadow-xl mb-6 border border-emerald-100 animate-in fade-in zoom-in duration-200">
          <h3 className="text-xs font-black uppercase text-emerald-600 mb-4 tracking-widest">Nova Meta de Reserva</h3>
          <div className="space-y-3">
            <input 
              placeholder="Nome (Ex: Viagem, Carro, Reserva)"
              className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            />
            <div className="grid grid-cols-2 gap-2">
              <input 
                placeholder="Valor Total" type="number"
                className="w-full border rounded-xl p-3 text-sm outline-none"
                value={formData.target} onChange={e => setFormData({...formData, target: e.target.value})}
              />
              <input 
                placeholder="Depósito Mensal" type="number"
                className="w-full border rounded-xl p-3 text-sm outline-none"
                value={formData.monthly} onChange={e => setFormData({...formData, monthly: e.target.value})}
              />
            </div>
            <button 
              onClick={() => {
                onAddGoal({ name: formData.name, targetAmount: Number(formData.target), monthlySaving: Number(formData.monthly) });
                setFormData({ name: '', target: '', monthly: '' });
                setIsAdding(false);
              }}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md"
            >
              CRIAR META AGORA
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {goals.map(goal => (
          <div key={goal.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-black text-gray-800 text-lg leading-tight">{goal.name}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Estimativa: {calculateEstimates(goal)}</p>
              </div>
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                R$ {goal.monthlySaving}/mês
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs font-bold text-gray-500">
                <span>R$ {goal.currentAmount.toLocaleString()}</span>
                <span>R$ {goal.targetAmount.toLocaleString()}</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000"
                  style={{ width: `${Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)}%` }}
                />
              </div>
            </div>

            {goal.advice && (
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                <p className="text-[11px] italic text-emerald-800 leading-relaxed">
                  <strong>FinAI diz:</strong> "{goal.advice}"
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Goals;
