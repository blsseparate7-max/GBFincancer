
import React, { useState, useMemo } from 'react';
import { SavingGoal, Transaction, Contribution } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';

interface GoalsProps {
  goals: SavingGoal[];
  onDeleteGoal: (id: string) => void;
  transactions: Transaction[];
  availableBalance: number;
  uid: string;
}

const Goals: React.FC<GoalsProps> = ({ goals, transactions, uid }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalLocation, setNewGoalLocation] = useState('');

  const [showAporteModal, setShowAporteModal] = useState<string | null>(null);
  const [aporteAmount, setAporteAmount] = useState('');
  const [aporteNote, setAporteNote] = useState('');

  // Cálculo do Saldo Livre para validação
  const saldoLivre = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalSaved = goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);
    return income - expense - totalSaved;
  }, [transactions, goals]);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleCreateGoal = async () => {
    if (!newGoalName || !newGoalTarget || !newGoalLocation) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }
    
    await dispatchEvent(uid, {
      type: 'CREATE_GOAL',
      payload: {
        name: newGoalName,
        targetAmount: parseFloat(newGoalTarget),
        location: newGoalLocation,
        currentAmount: 0,
        contributions: []
      },
      source: 'ui',
      createdAt: new Date()
    });

    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalLocation('');
    setShowAddForm(false);
  };

  const handleAddAporte = async () => {
    const val = parseFloat(aporteAmount);
    if (!showAporteModal || isNaN(val) || val <= 0) return;

    if (val > saldoLivre) {
      alert(`Saldo Livre insuficiente! Você tem ${format(saldoLivre)} disponível.`);
      return;
    }
    
    const res = await dispatchEvent(uid, {
      type: 'ADD_TO_GOAL',
      payload: {
        goalId: showAporteModal,
        amount: val,
        note: aporteNote,
        date: new Date().toISOString()
      },
      source: 'ui',
      createdAt: new Date()
    });

    if (res.success) {
      setAporteAmount('');
      setAporteNote('');
      setShowAporteModal(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir esta meta?")) {
      await dispatchEvent(uid, {
        type: 'DELETE_ITEM',
        payload: { id, collection: 'goals' },
        source: 'ui',
        createdAt: new Date()
      });
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade pb-32">
      <header className="mb-4">
        <h2 className="text-[10px] font-black text-[#00a884] uppercase tracking-[0.4em] mb-1">Patrimônio Manual</h2>
        <h1 className="text-3xl font-black text-[#111b21] uppercase italic tracking-tighter">Meus Cofres</h1>
      </header>

      <div className="bg-[#fff9c2] p-5 rounded-3xl border border-[#e1db9f] flex items-start gap-4">
        <span className="text-2xl">⚠️</span>
        <p className="text-[11px] text-[#111b21] font-bold leading-tight uppercase">
          Importante: O valor aportado sai do seu "Saldo Livre" do Dashboard e fica reservado no cofre escolhido.
        </p>
      </div>

      <div className="flex justify-between items-center px-1">
        <h3 className="text-[10px] font-black text-[#667781] uppercase tracking-widest">Seus Objetivos</h3>
        <button onClick={() => setShowAddForm(true)} className="text-[10px] font-black text-[#00a884] uppercase">+ Novo Cofre</button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {goals.map(goal => {
          const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
          return (
            <div key={goal.id} className="bg-white p-8 rounded-[3rem] border border-[#d1d7db] shadow-sm relative group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-2xl font-black text-[#111b21] uppercase italic tracking-tighter">{goal.name}</h4>
                  <p className="text-[10px] text-[#00a884] font-black uppercase mt-1">📍 Local: {goal.location}</p>
                </div>
                <button onClick={() => handleDelete(goal.id)} className="p-2 text-red-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">🗑️</button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div>
                  <p className="text-[9px] font-black text-[#667781] uppercase mb-1">Total Guardado</p>
                  <p className="text-lg font-black text-[#111b21]">{format(goal.currentAmount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-[#667781] uppercase mb-1">Valor Alvo</p>
                  <p className="text-lg font-black text-[#111b21]">{format(goal.targetAmount)}</p>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                <div className="flex justify-between items-end text-[10px] font-black text-[#667781]">
                  <span>PROGRESSO DO COFRE</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-3 w-full bg-[#f0f2f5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#00a884] transition-all duration-1000 shadow-sm" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <button 
                onClick={() => setShowAporteModal(goal.id)}
                className="w-full bg-[#111b21] text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all mb-6"
              >
                💰 Aportar agora
              </button>

              {goal.contributions && goal.contributions.length > 0 && (
                <div className="pt-6 border-t border-gray-50">
                  <p className="text-[9px] font-black text-[#667781] uppercase mb-3 tracking-widest">Histórico de Aportes</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                    {goal.contributions.slice().reverse().map((c: Contribution) => (
                      <div key={c.id} className="flex justify-between items-center bg-[#f8fafc] p-3 rounded-xl border border-gray-100">
                        <div>
                          <p className="text-[10px] font-black text-[#111b21]">{format(c.amount)}</p>
                          <p className="text-[8px] text-[#667781] uppercase font-bold">{new Date(c.date).toLocaleDateString()} {c.note && `• ${c.note}`}</p>
                        </div>
                        <span className="text-[8px] text-[#00a884] font-black uppercase">Guardado</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modais de Criar e Aportar (Reutilizando a lógica do Dashboard) */}
      {showAddForm && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative animate-fade">
            <button onClick={() => setShowAddForm(false)} className="absolute top-8 right-8 text-[#667781] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[#111b21] uppercase italic mb-6">Novo Cofre</h3>
            <div className="space-y-4">
              <input className="w-full bg-[#f0f2f5] rounded-xl p-4 text-sm font-bold outline-none" placeholder="Nome (Ex: Reserva)" value={newGoalName} onChange={e => setNewGoalName(e.target.value)} />
              <input type="number" className="w-full bg-[#f0f2f5] rounded-xl p-4 text-sm font-bold outline-none" placeholder="Meta R$" value={newGoalTarget} onChange={e => setNewGoalTarget(e.target.value)} />
              <input className="w-full bg-[#f0f2f5] rounded-xl p-4 text-sm font-bold outline-none" placeholder="Onde guarda? (Ex: Inter)" value={newGoalLocation} onChange={e => setNewGoalLocation(e.target.value)} />
              <button onClick={handleCreateGoal} className="w-full bg-[#00a884] text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-lg mt-4">Criar Cofre</button>
            </div>
          </div>
        </div>
      )}

      {showAporteModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative animate-fade text-center">
            <button onClick={() => setShowAporteModal(null)} className="absolute top-8 right-8 text-[#667781] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[#111b21] uppercase italic mb-2">Aporte Manual</h3>
            <p className="text-[10px] text-[#667781] font-bold uppercase mb-8 italic">Disponível no Saldo Livre: {format(saldoLivre)}</p>
            <div className="space-y-4">
              <input type="number" autoFocus className="w-full bg-[#f0f2f5] rounded-2xl p-6 text-2xl font-black text-center outline-none border-2 border-transparent focus:border-[#00a884]" placeholder="0,00" value={aporteAmount} onChange={e => setAporteAmount(e.target.value)} />
              <input className="w-full bg-[#f0f2f5] rounded-xl p-4 text-xs font-bold outline-none" placeholder="Nota (Ex: Sobra do bônus)" value={aporteNote} onChange={e => setAporteNote(e.target.value)} />
              <button onClick={handleAddAporte} className="w-full bg-[#00a884] text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-lg mt-4">Confirmar e Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
