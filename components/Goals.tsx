
import React, { useState, useMemo } from 'react';
import { SavingGoal, Transaction, Contribution } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import MoneyInput from './MoneyInput';

interface GoalsProps {
  goals: SavingGoal[];
  transactions: Transaction[];
  uid: string;
  loading?: boolean;
}

const Goals: React.FC<GoalsProps> = ({ goals, transactions, uid, loading }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalLocation, setNewGoalLocation] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<SavingGoal['category']>('Outros');
  const [newGoalPriority, setNewGoalPriority] = useState<SavingGoal['priority']>('Média');
  const [newGoalIcon, setNewGoalIcon] = useState('💰');

  const [showAporteModal, setShowAporteModal] = useState<string | null>(null);
  const [showGastoModal, setShowGastoModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [aporteAmount, setAporteAmount] = useState('');
  const [aporteNote, setAporteNote] = useState('');
  
  const [gastoAmount, setGastoAmount] = useState('');
  const [gastoDesc, setGastoDesc] = useState('');
  const [gastoCat, setGastoCat] = useState('Lazer');
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const categories = ['Viagem', 'Carro', 'Casa', 'Reserva', 'Educação', 'Lazer', 'Outros'];
  const priorities = ['Baixa', 'Média', 'Alta'];
  const icons = ['💰', '🚗', '🏠', '✈️', '🎓', '🏥', '🎮', '💍', '👶', '🏖️', '💻', '📈'];

  // Cálculo da Sobra Mensal e Capacidade de Guardar
  const { sobraMensal, capacidadeGuardar } = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalSaved = goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);
    
    const sobra = income - expense;
    const livre = sobra - totalSaved;
    const capacidade = Math.max(0, Math.min(sobra * 0.30, livre));
    
    return { sobraMensal: sobra, capacidadeGuardar: capacidade };
  }, [transactions, goals]);

  const saldoLivre = sobraMensal - goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleCreateGoal = async () => {
    if (!newGoalName || !newGoalTarget || !newGoalLocation) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }
    
    if (editingGoalId) {
      await dispatchEvent(uid, {
        type: 'UPDATE_GOAL',
        payload: {
          goalId: editingGoalId,
          name: newGoalName,
          targetAmount: parseFloat(newGoalTarget),
          location: newGoalLocation,
          category: newGoalCategory,
          priority: newGoalPriority,
          icon: newGoalIcon,
        },
        source: 'ui',
        createdAt: new Date()
      });
    } else {
      await dispatchEvent(uid, {
        type: 'CREATE_GOAL',
        payload: {
          name: newGoalName,
          targetAmount: parseFloat(newGoalTarget),
          location: newGoalLocation,
          currentAmount: 0,
          category: newGoalCategory,
          priority: newGoalPriority,
          icon: newGoalIcon,
          contributions: []
        },
        source: 'ui',
        createdAt: new Date()
      });
    }

    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalLocation('');
    setNewGoalCategory('Outros');
    setNewGoalPriority('Média');
    setNewGoalIcon('💰');
    setShowAddForm(false);
    setEditingGoalId(null);
  };

  const handleEdit = (goal: SavingGoal) => {
    setEditingGoalId(goal.id);
    setNewGoalName(goal.name);
    setNewGoalTarget(goal.targetAmount?.toString() || '0');
    setNewGoalLocation(goal.location);
    setNewGoalCategory(goal.category || 'Outros');
    setNewGoalPriority(goal.priority || 'Média');
    setNewGoalIcon(goal.icon || '💰');
    setShowAddForm(true);
  };

  const calculateEstimatedDate = (goal: SavingGoal) => {
    if (!goal.contributions || goal.contributions.length === 0) return 'Sem dados';
    
    const remaining = goal.targetAmount - goal.currentAmount;
    if (remaining <= 0) return 'Concluída!';

    // Média de aportes mensais (simplificado)
    const totalAportes = goal.contributions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const firstDate = new Date(goal.contributions[0].date);
    const lastDate = new Date();
    const monthsDiff = Math.max(1, (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + (lastDate.getMonth() - firstDate.getMonth()));
    
    const avgMonthly = totalAportes / monthsDiff;
    if (avgMonthly <= 0) return 'Indeterminado';

    const monthsToFinish = Math.ceil(remaining / avgMonthly);
    const finishDate = new Date();
    finishDate.setMonth(finishDate.getMonth() + monthsToFinish);
    
    return finishDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
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

  const handleQuickAporte = async (goalId: string, amount: number) => {
    if (amount <= 0) return;
    
    const res = await dispatchEvent(uid, {
      type: 'ADD_TO_GOAL',
      payload: {
        goalId,
        amount,
        note: 'Aporte sugerido pelo sistema',
        date: new Date().toISOString()
      },
      source: 'ui',
      createdAt: new Date()
    });

    if (res.success) {
      setSuccessMessage(`Parabéns! Você guardou ${format(amount)} na meta.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const handleSpendFromGoal = async () => {
    const val = parseFloat(gastoAmount);
    if (!showGastoModal || isNaN(val) || val <= 0) return;

    const goal = goals.find(g => g.id === showGastoModal);
    if (!goal) return;

    if (val > goal.currentAmount) {
      alert(`Saldo insuficiente na meta! Você tem ${format(goal.currentAmount)} guardado.`);
      return;
    }

    console.log("Processando gasto da meta:", { goalId: showGastoModal, val });

    const res = await dispatchEvent(uid, {
      type: 'SPEND_FROM_GOAL',
      payload: {
        goalId: showGastoModal,
        amount: val,
        description: gastoDesc,
        category: gastoCat
      },
      source: 'ui',
      createdAt: new Date()
    });

    if (res.success) {
      setSuccessMessage(`${format(val)} retirados da meta ${goal.name}.`);
      setGastoAmount('');
      setGastoDesc('');
      setShowGastoModal(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      alert("Erro ao processar gasto da meta.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    
    try {
      console.log("Excluindo meta:", id);
      const res = await dispatchEvent(uid, {
        type: 'DELETE_GOAL',
        payload: { goalId: id },
        source: 'ui',
        createdAt: new Date()
      });

      if (!res.success) {
        throw new Error(res.error?.toString() || "Erro desconhecido");
      }
      setShowDeleteConfirm(null);
    } catch (err: any) {
      console.error("Erro ao excluir meta:", err);
      alert(`Erro ao excluir meta: ${err.message || "Tente novamente."}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-20 bg-white/50 rounded-3xl"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-white/50 rounded-3xl"></div>
          <div className="h-24 bg-white/50 rounded-3xl"></div>
        </div>
        <div className="h-64 bg-white/50 rounded-[3rem]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade pb-32 no-scrollbar">
      <header className="mb-4">
        <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Patrimônio Manual</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Meus Cofres</h1>
      </header>

      {successMessage && (
        <div className="bg-[var(--green-whatsapp)] text-white p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-bounce shadow-lg flex items-center gap-3">
          <span>🎉</span> {successMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-[var(--border)] shadow-sm">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Total em Cofres</p>
          <h4 className="text-xl font-black text-[var(--green-whatsapp)]">{format(goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0))}</h4>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[var(--border)] shadow-sm">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Meta Acumulada</p>
          <h4 className="text-xl font-black text-[var(--text-primary)]">{format(goals.reduce((s, g) => s + (Number(g.targetAmount) || 0), 0))}</h4>
        </div>
      </div>

      <div className="bg-amber-100 p-5 rounded-3xl border border-amber-200 flex items-start gap-4">
        <span className="text-2xl">💡</span>
        <div>
          <p className="text-[11px] text-[var(--text-primary)] font-bold leading-tight uppercase mb-1">
            Dica: O valor aportado sai do seu "Saldo Livre" do Dashboard e fica reservado no cofre escolhido.
          </p>
          <p className="text-[9px] text-amber-700 font-black uppercase">
            Sua capacidade de poupança ideal: <span className="text-amber-900">{format(capacidadeGuardar)}/mês</span> (30% da sobra)
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center px-1">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Seus Objetivos</h3>
        <button onClick={() => setShowAddForm(true)} className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase flex items-center gap-1">
          <span className="text-lg">+</span> Novo Cofre
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {goals.map(goal => {
          const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
          const estDate = calculateEstimatedDate(goal);
          
          return (
            <div key={goal.id} className="bg-white p-8 rounded-[3rem] border border-[var(--border)] shadow-sm relative group overflow-hidden">
              {/* Badge de Prioridade */}
              {goal.priority && (
                <div className={`absolute top-0 right-12 px-4 py-1.5 rounded-b-2xl text-[8px] font-black uppercase tracking-widest text-white ${
                  goal.priority === 'Alta' ? 'bg-red-500' : goal.priority === 'Média' ? 'bg-amber-500' : 'bg-blue-500'
                }`}>
                  {goal.priority}
                </div>
              )}

              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4 items-center">
                  <div className="w-14 h-14 bg-[var(--bg-body)] rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                    {goal.icon || '💰'}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">{goal.name}</h4>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[9px] bg-[var(--bg-body)] px-2 py-0.5 rounded-full text-[var(--text-muted)] font-black uppercase tracking-tighter">📍 {goal.location}</span>
                      {goal.category && <span className="text-[9px] bg-[var(--green-whatsapp)]/10 px-2 py-0.5 rounded-full text-[var(--green-whatsapp)] font-black uppercase tracking-tighter">🏷️ {goal.category}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEdit(goal); }} 
                    className="p-3 text-amber-600 transition-all bg-amber-50 hover:bg-amber-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-90"
                    title="Editar Meta"
                  >
                    <span className="text-sm">✏️</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(goal.id); }} 
                    className="p-3 text-red-600 transition-all bg-red-50 hover:bg-red-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-90"
                    title="Excluir Meta"
                  >
                    <span className="text-sm">🗑️</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[var(--bg-body)] p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Total Guardado</p>
                  <p className="text-xl font-black text-[var(--text-primary)]">{format(goal.currentAmount)}</p>
                </div>
                <div className="bg-[var(--bg-body)] p-4 rounded-2xl text-right">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Valor Alvo</p>
                  <p className="text-xl font-black text-[var(--text-primary)]">{format(goal.targetAmount)}</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex justify-between items-end text-[10px] font-black">
                  <span className="text-[var(--text-muted)] uppercase tracking-widest">Progresso do Objetivo</span>
                  <span className="text-[var(--green-whatsapp)]">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-4 w-full bg-[var(--bg-body)] rounded-full overflow-hidden p-1 border border-black/5 relative">
                  <div className="h-full bg-[var(--green-whatsapp)] rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,168,132,0.3)]" style={{ width: `${pct}%` }} />
                </div>
                
                {/* Sugestão Dinâmica */}
                <div className="bg-[var(--bg-body)]/50 p-4 rounded-2xl border border-dashed border-black/5 space-y-2">
                  {capacidadeGuardar > 0 ? (
                    <>
                      <p className="text-[9px] font-black text-[var(--text-primary)] uppercase">
                        ✨ Sugestão: Você consegue guardar <span className="text-[var(--green-whatsapp)]">{format(capacidadeGuardar)}/mês</span>
                      </p>
                      <div className="flex justify-between text-[8px] font-bold text-[var(--text-muted)] uppercase italic">
                        <span>Tempo estimado: {Math.ceil((goal.targetAmount - goal.currentAmount) / capacidadeGuardar)} meses</span>
                        <span>Se guardar metade: {Math.ceil((goal.targetAmount - goal.currentAmount) / (capacidadeGuardar / 2))} meses</span>
                      </div>
                      <button 
                        onClick={() => handleQuickAporte(goal.id, capacidadeGuardar)}
                        className="w-full mt-2 bg-white border border-[var(--green-whatsapp)] text-[var(--green-whatsapp)] py-2 rounded-xl text-[8px] font-black uppercase hover:bg-[var(--green-whatsapp)] hover:text-white transition-all active:scale-95"
                      >
                        Aportar Sugestão ({format(capacidadeGuardar)})
                      </button>
                    </>
                  ) : (
                    <p className="text-[9px] font-black text-rose-500 uppercase text-center italic">
                      ⚠️ Sem sobra suficiente este mês para avançar. Ajuste gastos.
                    </p>
                  )}
                </div>

                <div className="flex justify-between items-center text-[9px] font-black text-[var(--text-muted)] uppercase italic">
                  <span>Faltam {format(goal.targetAmount - goal.currentAmount)}</span>
                  <span>Previsão: {estDate}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 mb-6">
                <button 
                  onClick={() => setShowAporteModal(goal.id)}
                  className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase shadow-xl shadow-[var(--green-whatsapp)]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span>⚡</span> Aportar no Cofre
                </button>
                <button 
                  onClick={() => setShowGastoModal(goal.id)}
                  className="w-full bg-white border-2 border-rose-500 text-rose-500 py-4 rounded-[1.5rem] font-black text-[10px] uppercase hover:bg-rose-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>💸</span> Gastar da Meta
                </button>
              </div>

              {goal.contributions && goal.contributions.length > 0 && (
                <div className="pt-6 border-t border-gray-50">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-3 tracking-widest">Histórico Recente</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                    {goal.contributions.slice().reverse().map((c: Contribution) => (
                      <div key={c.id} className="flex justify-between items-center bg-[var(--bg-body)] p-4 rounded-2xl border border-black/5">
                        <div>
                          <p className="text-xs font-black text-[var(--text-primary)]">{format(c.amount)}</p>
                          <p className="text-[8px] text-[var(--text-muted)] uppercase font-bold">{new Date(c.date).toLocaleDateString()} {c.note && `• ${c.note}`}</p>
                        </div>
                        <span className="text-[8px] bg-white px-2 py-1 rounded-lg text-[var(--green-whatsapp)] font-black uppercase shadow-sm">Confirmado</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Criar Meta */}
      {showAddForm && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] p-10 shadow-2xl relative animate-fade max-h-[90vh] overflow-y-auto no-scrollbar">
            <button onClick={() => { setShowAddForm(false); setEditingGoalId(null); }} className="absolute top-10 right-10 text-[var(--text-muted)] font-black text-xl">✕</button>
            <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic mb-8 tracking-tighter">
              {editingGoalId ? 'Editar Objetivo' : 'Novo Objetivo'}
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Ícone Representativo</label>
                <div className="flex flex-wrap gap-2 p-4 bg-[var(--bg-body)] rounded-3xl">
                  {icons.map(icon => (
                    <button 
                      key={icon} 
                      onClick={() => setNewGoalIcon(icon)}
                      className={`w-10 h-10 flex items-center justify-center text-xl rounded-xl transition-all ${newGoalIcon === icon ? 'bg-[var(--green-whatsapp)] scale-110 shadow-lg' : 'bg-white hover:bg-gray-50'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Nome do Objetivo</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] border-2 border-transparent transition-all" placeholder="Ex: Viagem para Maldivas" value={newGoalName} onChange={e => setNewGoalName(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Meta Financeira</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] border-2 border-transparent transition-all" 
                    placeholder="R$ 0,00" 
                    value={Number(newGoalTarget) || 0} 
                    onChange={val => setNewGoalTarget(val.toString())} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Onde Guardar?</label>
                  <input className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] border-2 border-transparent transition-all" placeholder="Ex: NuConta" value={newGoalLocation} onChange={e => setNewGoalLocation(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Categoria</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] border-2 border-transparent transition-all appearance-none"
                    value={newGoalCategory}
                    onChange={e => setNewGoalCategory(e.target.value as any)}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Prioridade</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] border-2 border-transparent transition-all appearance-none"
                    value={newGoalPriority}
                    onChange={e => setNewGoalPriority(e.target.value as any)}
                  >
                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={handleCreateGoal} className="w-full bg-[var(--text-primary)] text-white py-6 rounded-[2rem] font-black text-[11px] uppercase shadow-2xl mt-4 active:scale-95 transition-all">
                {editingGoalId ? '💾 Salvar Alterações' : '🚀 Ativar Objetivo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aporte */}
      {showAporteModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl relative animate-fade text-center">
            <button onClick={() => setShowAporteModal(null)} className="absolute top-10 right-10 text-[var(--text-muted)] font-black text-xl">✕</button>
            <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic mb-2 tracking-tighter">Aporte Manual</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase mb-10 italic">Disponível: {format(saldoLivre)}</p>
            
            <div className="space-y-6">
              <div className="relative">
                <MoneyInput 
                  autoFocus 
                  className="w-full bg-[var(--bg-body)] rounded-3xl p-8 text-3xl font-black text-center outline-none border-2 border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                  placeholder="R$ 0,00" 
                  value={Number(aporteAmount) || 0} 
                  onChange={val => setAporteAmount(val.toString())} 
                />
              </div>
              <input className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] border-2 border-transparent transition-all" placeholder="Nota opcional (Ex: Bônus do mês)" value={aporteNote} onChange={e => setAporteNote(e.target.value)} />
              <button onClick={handleAddAporte} className="w-full bg-[var(--green-whatsapp)] text-white py-6 rounded-[2rem] font-black text-[11px] uppercase shadow-xl shadow-[var(--green-whatsapp)]/20 mt-4 active:scale-95 transition-all">
                ✨ Confirmar e Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gasto da Meta */}
      {showGastoModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl relative animate-fade text-center">
            <button onClick={() => setShowGastoModal(null)} className="absolute top-10 right-10 text-[var(--text-muted)] font-black text-xl">✕</button>
            <h3 className="text-2xl font-black text-rose-500 uppercase italic mb-2 tracking-tighter">Gastar da Meta</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase mb-10 italic">
              Saldo na Meta: {format(goals.find(g => g.id === showGastoModal)?.currentAmount || 0)}
            </p>
            
            <div className="space-y-4">
              <div className="relative">
                <MoneyInput 
                  autoFocus 
                  className="w-full bg-[var(--bg-body)] rounded-3xl p-8 text-3xl font-black text-center outline-none border-2 border-transparent focus:border-rose-500 transition-all" 
                  placeholder="R$ 0,00" 
                  value={Number(gastoAmount) || 0} 
                  onChange={val => setGastoAmount(val.toString())} 
                />
              </div>
              <input 
                className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-xs font-bold outline-none focus:border-rose-500 border-2 border-transparent transition-all" 
                placeholder="O que você comprou?" 
                value={gastoDesc} 
                onChange={e => setGastoDesc(e.target.value)} 
              />
              <select 
                className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-xs font-bold outline-none focus:border-rose-500 border-2 border-transparent transition-all appearance-none"
                value={gastoCat}
                onChange={e => setGastoCat(e.target.value)}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={handleSpendFromGoal} className="w-full bg-rose-500 text-white py-6 rounded-[2rem] font-black text-[11px] uppercase shadow-xl shadow-rose-500/20 mt-4 active:scale-95 transition-all">
                💸 Confirmar Gasto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative animate-fade text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🗑️</span>
            </div>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-2 tracking-tighter">Excluir Meta?</h3>
            <p className="text-xs text-[var(--text-muted)] font-bold mb-8">
              Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => handleDelete(showDeleteConfirm)} 
                className="flex-1 bg-rose-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-rose-500/20 active:scale-95 transition-all"
              >
                Sim, Excluir
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(null)} 
                className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
