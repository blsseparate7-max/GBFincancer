import React, { useState, useMemo, useEffect } from 'react';
import { Debt, Transaction, Wallet, UserSession, DebtType, DebtStatus, SavingGoal, CreditCardInfo } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import MoneyInput from './MoneyInput';
import { Notification, ConfirmModal } from './UI';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { normalizeDebt } from '../services/normalizationService';
import { 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Calculator, 
  Zap, 
  Snowflake, 
  Filter, 
  Plus, 
  Clock, 
  Target,
  Info,
  ChevronRight,
  Trash2,
  Edit3,
  History,
  DollarSign,
  PieChart
} from 'lucide-react';

interface DebtAssistantProps {
  uid: string;
  transactions: Transaction[];
  wallets: Wallet[];
  user: UserSession;
  goals: SavingGoal[];
  cards: CreditCardInfo[];
}

const DebtAssistant: React.FC<DebtAssistantProps> = ({ uid, transactions, wallets, user, goals, cards }) => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [filterStatus, setFilterStatus] = useState<DebtStatus | 'TODAS'>('TODAS');
  const [extraSimulation, setExtraSimulation] = useState(0);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form state for debt
  const [debtForm, setDebtForm] = useState({
    name: '',
    totalAmount: 0,
    remainingAmount: 0,
    installmentAmount: 0,
    type: 'CARTAO_CREDITO' as DebtType,
    interestRate: 0,
    remainingInstallments: 0,
    status: 'ATIVA' as DebtStatus,
    observation: ''
  });

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "users", uid, "debts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => normalizeDebt(d));
      setDebts(data);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const stats = useMemo(() => {
    const activeDebts = debts.filter(d => d.status !== 'QUITADA');
    const totalRemaining = activeDebts.reduce((acc, d) => acc + (d.remainingAmount || 0), 0);
    const totalInitial = debts.reduce((acc, d) => acc + (d.totalAmount || 0), 0);
    const monthlyInstallments = activeDebts.filter(d => d.status === 'EM_PAGAMENTO').reduce((acc, d) => acc + (d.installmentAmount || 0), 0);
    const monthlyIncome = user.incomeProfile?.totalExpectedMonthly || 0;
    
    const impactPercent = monthlyIncome > 0 ? (monthlyInstallments / monthlyIncome) * 100 : 0;
    
    let impactStatus: 'healthy' | 'attention' | 'critical' = 'healthy';
    if (impactPercent > 35) impactStatus = 'critical';
    else if (impactPercent > 20) impactStatus = 'attention';

    // Suggested Payoff Amount
    // Sobra = Renda - Gastos do Mês - Metas - Faturas CC
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthExpenses = transactions
      .filter(t => t.type === 'EXPENSE' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
      .reduce((acc, t) => acc + Number(t.amount), 0);
    
    const totalGoalsMonthly = goals.reduce((acc, g) => acc + ((g.targetAmount - g.currentAmount) / Math.max(1, g.deadlineMonths || 12)), 0);
    const totalCCInvoices = cards.reduce((acc, c) => acc + (c.invoiceAmount || 0), 0);
    
    // Consideramos a sobra real e também o potencial de economia baseado nos limites
    const rawSurplus = monthlyIncome - monthExpenses - totalGoalsMonthly - totalCCInvoices;
    
    // Sugerimos 40% da sobra real + 10% de economia potencial se houver renda
    const suggestedExtra = Math.max(0, (rawSurplus * 0.4) + (monthlyIncome * 0.05)); 

    // Time Estimates
    const monthsCurrent = monthlyInstallments > 0 ? totalRemaining / monthlyInstallments : 0;
    const monthsSuggested = (monthlyInstallments + suggestedExtra) > 0 ? totalRemaining / (monthlyInstallments + suggestedExtra) : 0;
    const monthsSimulated = (monthlyInstallments + extraSimulation) > 0 ? totalRemaining / (monthlyInstallments + extraSimulation) : 0;

    // Priority Suggestion
    const debtsWithInterest = activeDebts.filter(d => (d.interestRate || 0) > 0).sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
    const smallestDebts = activeDebts.sort((a, b) => a.remainingAmount - b.remainingAmount);
    
    let priorityDebt = null;
    let priorityReason = "";
    if (debtsWithInterest.length > 0) {
      priorityDebt = debtsWithInterest[0];
      priorityReason = `Possui a maior taxa de juros (${priorityDebt.interestRate}%). Priorizar esta dívida economizará mais dinheiro a longo prazo (Método Avalanche).`;
    } else if (smallestDebts.length > 0) {
      priorityDebt = smallestDebts[0];
      priorityReason = `É a sua menor dívida. Quitá-la rapidamente dará um fôlego psicológico e financeiro (Método Bola de Neve).`;
    }

    // Expense Cuts
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const categorySpending = transactions
      .filter(t => t.type === 'EXPENSE' && new Date(t.date).getTime() > last30Days.getTime())
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

    const topCuts = Object.entries(categorySpending)
      .map(([category, amount]) => ({ category, amount: amount as number, cut: (amount as number) * 0.2 }))
      .sort((a, b) => (b.amount as number) - (a.amount as number))
      .slice(0, 2);

    return {
      totalRemaining,
      totalInitial,
      monthlyInstallments,
      impactPercent,
      impactStatus,
      suggestedExtra,
      monthsCurrent,
      monthsSuggested,
      monthsSimulated,
      priorityDebt,
      priorityReason,
      topCuts,
      counts: {
        total: debts.length,
        inPayment: debts.filter(d => d.status === 'EM_PAGAMENTO').length,
        paid: debts.filter(d => d.status === 'QUITADA').length,
        waiting: debts.filter(d => d.status === 'EM_ESPERA').length,
        active: debts.filter(d => d.status === 'ATIVA').length
      }
    };
  }, [debts, user, transactions, goals, cards, extraSimulation]);

  const handleSaveDebt = async () => {
    if (!debtForm.name || debtForm.totalAmount <= 0) {
      setNotification({ message: "Preencha o nome e o valor total.", type: 'error' });
      return;
    }

    const payload = {
      ...debtForm,
      remainingAmount: debtForm.remainingAmount || debtForm.totalAmount,
      updatedAt: new Date()
    };

    if (editingDebt) {
      await dispatchEvent(uid, {
        type: 'UPDATE_DEBT',
        payload: { id: editingDebt.id, ...payload },
        source: 'ui',
        createdAt: new Date()
      });
    } else {
      await dispatchEvent(uid, {
        type: 'CREATE_DEBT',
        payload: { ...payload, createdAt: new Date() },
        source: 'ui',
        createdAt: new Date()
      });
    }

    setShowAddModal(false);
    setEditingDebt(null);
    resetForm();
  };

  const resetForm = () => {
    setDebtForm({
      name: '',
      totalAmount: 0,
      remainingAmount: 0,
      installmentAmount: 0,
      type: 'CARTAO_CREDITO',
      interestRate: 0,
      remainingInstallments: 0,
      status: 'ATIVA',
      observation: ''
    });
  };

  const handleDeleteDebt = async (id: string) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    
    await dispatchEvent(uid, {
      type: 'DELETE_DEBT',
      payload: { id: confirmDelete },
      source: 'ui',
      createdAt: new Date()
    });
    
    setConfirmDelete(null);
    setNotification({ message: "Dívida excluída com sucesso!", type: 'success' });
  };

  const filteredDebts = debts.filter(d => filterStatus === 'TODAS' || d.status === filterStatus);

  if (loading) return <div className="p-10 text-center animate-pulse font-black uppercase tracking-widest text-[var(--text-muted)]">Analisando passivos...</div>;

  return (
    <div className="p-3 md:p-6 space-y-6 animate-fade pb-32 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-1">
        <div>
          <h2 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.4em] mb-1">Mapa da Liberdade</h2>
          <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Estou Endividado</h1>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="bg-[var(--green-whatsapp)] text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-[var(--green-whatsapp)]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
        >
          <Plus size={16} /> Adicionar Nova Dívida
        </button>
      </header>

      {/* 1. Visão Geral Superior */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-3xl border border-[var(--border)] shadow-sm">
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Total em Dívidas</p>
          <h3 className="text-2xl font-black text-rose-500 italic">{format(stats.totalRemaining)}</h3>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[9px] font-bold px-2 py-1 bg-rose-500/10 text-rose-500 rounded-lg uppercase">{stats.counts.total} Total</span>
            <span className="text-[9px] font-bold px-2 py-1 bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)] rounded-lg uppercase">{stats.counts.paid} Quitadas</span>
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-3xl border border-[var(--border)] shadow-sm">
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Parcelas Mensais</p>
          <h3 className="text-2xl font-black text-[var(--text-primary)] italic">{format(stats.monthlyInstallments)}</h3>
          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase mt-3 flex items-center gap-1">
            <Clock size={12} /> {stats.counts.inPayment} em pagamento
          </p>
        </div>

        <div className={`p-5 rounded-3xl border shadow-sm ${
          stats.impactStatus === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
          stats.impactStatus === 'attention' ? 'bg-amber-400/10 border-amber-400/20 text-amber-500' :
          'bg-[var(--green-whatsapp)]/10 border-[var(--green-whatsapp)]/20 text-[var(--green-whatsapp)]'
        }`}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-2">Impacto na Renda</p>
          <h3 className="text-2xl font-black italic">{stats.impactPercent.toFixed(1)}%</h3>
          <div className="mt-3 space-y-2">
            <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${
                  stats.impactStatus === 'critical' ? 'bg-rose-500' :
                  stats.impactStatus === 'attention' ? 'bg-amber-400' :
                  'bg-[var(--green-whatsapp)]'
                }`}
                style={{ width: `${Math.min(100, stats.impactPercent)}%` }}
              />
            </div>
            <p className="text-[9px] font-black uppercase flex items-center gap-1">
              {stats.impactStatus === 'critical' ? '⚠️ Nível Crítico' :
               stats.impactStatus === 'attention' ? '⚡ Atenção' :
               '✅ Nível Saudável'}
            </p>
          </div>
        </div>

        <div className="bg-[var(--green-whatsapp)] p-5 rounded-3xl text-white shadow-xl shadow-[var(--green-whatsapp)]/20 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
            <Zap size={100} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-80">Valor Sugerido para Quitar</p>
          <h3 className="text-2xl font-black italic">{format(stats.suggestedExtra)}</h3>
          <p className="text-[9px] font-bold uppercase mt-3 opacity-80 flex items-center gap-1">
            <Calculator size={12} /> Acelere sua liberdade
          </p>
        </div>
      </section>

      {/* 2. Tempo Estimado e Simulação */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="text-amber-500" size={20} />
              <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Tempo para ser Livre</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)]">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-2">No ritmo atual</p>
                <p className="text-lg font-black text-[var(--text-primary)] italic">{Math.ceil(stats.monthsCurrent)} Meses</p>
                <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase mt-1">Pagando {format(stats.monthlyInstallments)}/mês</p>
              </div>
              <div className="p-4 bg-[var(--green-whatsapp)]/5 rounded-2xl border border-[var(--green-whatsapp)]/20">
                <p className="text-[9px] font-black text-[var(--green-whatsapp)] uppercase mb-2">Com valor sugerido</p>
                <p className="text-lg font-black text-[var(--green-whatsapp)] italic">{Math.ceil(stats.monthsSuggested)} Meses</p>
                <p className="text-[8px] font-bold text-[var(--green-whatsapp)] uppercase mt-1">Economia de {Math.ceil(Math.abs(stats.monthsCurrent - stats.monthsSuggested))} meses</p>
              </div>
            </div>

            <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase">Simulador de Aporte Extra</h4>
                <span className="text-sm font-black text-[var(--green-whatsapp)]">{format(extraSimulation)}</span>
              </div>
              <input 
                type="range" min="0" max="5000" step="50" value={extraSimulation}
                onChange={(e) => setExtraSimulation(Number(e.target.value))}
                className="w-full h-1.5 bg-[var(--surface)] rounded-full appearance-none cursor-pointer accent-[var(--green-whatsapp)]"
              />
              <div className="pt-2 border-t border-[var(--border)]">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Resultado da Simulação:</p>
                <p className="text-base font-black text-[var(--text-primary)] italic">
                  Quitação em <span className="text-[var(--green-whatsapp)]">{Math.ceil(stats.monthsSimulated)} meses</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] space-y-6">
          <div className="flex items-center gap-3">
            <TrendingDown className="text-rose-500" size={20} />
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Cortes Sugeridos</h3>
          </div>
          <div className="space-y-4">
            {stats.topCuts.length > 0 ? stats.topCuts.map((cut, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)]">
                <div>
                  <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">{cut.category}</p>
                  <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Gasto: {format(cut.amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase">Liberar</p>
                  <p className="text-sm font-black text-[var(--green-whatsapp)]">+{format(cut.cut)}</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-4 text-[10px] text-[var(--text-muted)] uppercase font-bold italic">Sem dados de gastos recentes</div>
            )}
            <div className="p-4 bg-amber-400/5 rounded-2xl border border-amber-400/20 flex gap-3">
              <Info size={16} className="text-amber-500 shrink-0" />
              <p className="text-[9px] text-[var(--text-muted)] leading-relaxed italic">
                Reduzindo 20% desses gastos, você libera <span className="font-black text-[var(--text-primary)]">{format(stats.topCuts.reduce((a, b) => a + b.cut, 0))}</span> extras para suas dívidas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Prioridade de Pagamento */}
      {stats.priorityDebt && (
        <section className="bg-[var(--surface)] p-6 rounded-3xl border-2 border-[var(--green-whatsapp)]/30 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            {stats.priorityDebt.interestRate ? <Zap size={80} /> : <Snowflake size={80} />}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[var(--green-whatsapp)] rounded-full flex items-center justify-center text-white">
              <ArrowRight size={18} />
            </div>
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Sugestão de Prioridade</h3>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <h4 className="text-lg font-black text-[var(--text-primary)] uppercase italic mb-2">{stats.priorityDebt.name}</h4>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-2xl">
                {stats.priorityReason}
              </p>
            </div>
            <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)] min-w-[200px]">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Valor Restante</p>
              <p className="text-base font-black text-rose-500">{format(stats.priorityDebt.remainingAmount)}</p>
            </div>
          </div>
        </section>
      )}

      {/* 4. Filtros e Lista de Dívidas */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar">
            {(['TODAS', 'ATIVA', 'EM_PAGAMENTO', 'EM_ESPERA', 'QUITADA'] as const).map(status => (
              <button 
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                  filterStatus === status 
                  ? 'bg-[var(--text-primary)] text-white border-[var(--text-primary)] shadow-lg' 
                  : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-primary)]'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-[var(--text-muted)] uppercase">
            <Filter size={14} /> {filteredDebts.length} Dívidas encontradas
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDebts.map(debt => {
            const progress = ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100;
            const isPaid = debt.status === 'QUITADA';
            const inPayment = debt.status === 'EM_PAGAMENTO';

            return (
              <div key={debt.id} className={`bg-[var(--surface)] p-5 rounded-3xl border border-[var(--border)] shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${isPaid ? 'opacity-60' : ''}`}>
                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                  debt.status === 'QUITADA' ? 'bg-[var(--green-whatsapp)]' :
                  debt.status === 'EM_PAGAMENTO' ? 'bg-amber-400' :
                  debt.status === 'EM_ESPERA' ? 'bg-blue-400' : 'bg-rose-500'
                }`} />

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                        debt.status === 'QUITADA' ? 'bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)]' :
                        debt.status === 'EM_PAGAMENTO' ? 'bg-amber-400/10 text-amber-500' :
                        debt.status === 'EM_ESPERA' ? 'bg-blue-400/10 text-blue-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {debt.status.replace('_', ' ')}
                      </span>
                      <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{debt.type.replace('_', ' ')}</span>
                    </div>
                    <h4 className="text-lg font-black text-[var(--text-primary)] uppercase italic tracking-tight">{debt.name}</h4>
                    {debt.observation && <p className="text-[10px] text-[var(--text-muted)] italic mt-1 truncate max-w-[200px]">{debt.observation}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => { setEditingDebt(debt); setDebtForm({...debt}); setShowAddModal(true); }}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--green-whatsapp)] hover:bg-[var(--green-whatsapp)]/10 rounded-xl transition-all"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteDebt(debt.id)}
                      className="p-2 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                      <span className="text-[var(--text-muted)]">Progresso da Quitação</span>
                      <span className="text-[var(--text-primary)]">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-[var(--bg-body)] rounded-full overflow-hidden border border-[var(--border)]">
                      <div 
                        className={`h-full transition-all duration-1000 ${isPaid ? 'bg-[var(--green-whatsapp)]' : 'bg-rose-500'}`} 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-[var(--text-muted)] uppercase italic">
                      <span>Dívida Inicial: {format(debt.totalAmount)}</span>
                      <span>Restante: {format(debt.remainingAmount)}</span>
                    </div>
                  </div>

                  {inPayment && (
                    <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Parcela Atual</p>
                        <p className="text-sm font-black text-[var(--text-primary)]">{format(debt.installmentAmount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Previsão de Quitação</p>
                        <p className="text-sm font-black text-rose-500 italic">{Math.ceil(debt.remainingAmount / debt.installmentAmount)} Meses</p>
                      </div>
                    </div>
                  )}

                  {!isPaid && (
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Simulação de Aceleração</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const extra = 100;
                            const currentMonths = Math.ceil(debt.remainingAmount / debt.installmentAmount);
                            const newMonths = Math.ceil(debt.remainingAmount / (debt.installmentAmount + extra));
                            setNotification({ 
                              message: `Simulação: Pagando +R$ ${extra}/mês, você quita em ${newMonths} meses (Economia de ${currentMonths - newMonths} meses).`,
                              type: 'info'
                            });
                          }}
                          className="flex-1 py-3 bg-[var(--bg-body)] border border-[var(--border)] rounded-xl text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-[var(--green-whatsapp)] hover:border-[var(--green-whatsapp)] transition-all flex flex-col items-center gap-1"
                        >
                          <span>+R$100</span>
                          <span className="text-[8px] opacity-60">Acelerar</span>
                        </button>
                        <button 
                          onClick={() => {
                            const extra = 200;
                            const currentMonths = Math.ceil(debt.remainingAmount / debt.installmentAmount);
                            const newMonths = Math.ceil(debt.remainingAmount / (debt.installmentAmount + extra));
                            setNotification({ 
                              message: `Simulação: Pagando +R$ ${extra}/mês, você quita em ${newMonths} meses (Economia de ${currentMonths - newMonths} meses).`,
                              type: 'info'
                            });
                          }}
                          className="flex-1 py-3 bg-[var(--bg-body)] border border-[var(--border)] rounded-xl text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-[var(--green-whatsapp)] hover:border-[var(--green-whatsapp)] transition-all flex flex-col items-center gap-1"
                        >
                          <span>+R$200</span>
                          <span className="text-[8px] opacity-60">Acelerar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal Adicionar/Editar Dívida */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="bg-[var(--surface)] w-full max-w-lg rounded-t-[2.5rem] md:rounded-3xl p-6 md:p-8 shadow-2xl relative animate-slide-up md:animate-fade max-h-[92vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 md:top-8 md:right-8 text-[var(--text-muted)] font-black text-xl hover:text-rose-500 transition-colors">✕</button>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-1 text-center">{editingDebt ? 'Editar Dívida' : 'Nova Dívida'}</h3>
            <p className="text-[9px] text-[var(--text-muted)] font-black uppercase mb-6 text-center tracking-widest opacity-60 italic">Diagnóstico para sua liberdade financeira</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Nome da Dívida</label>
                <input 
                  className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                  placeholder="Ex: Cartão Nubank, Empréstimo Itaú..."
                  value={debtForm.name}
                  onChange={e => setDebtForm({...debtForm, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Valor Total Original</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    value={debtForm.totalAmount}
                    onChange={val => setDebtForm({...debtForm, totalAmount: val})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Valor Restante Atual</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    value={debtForm.remainingAmount}
                    onChange={val => setDebtForm({...debtForm, remainingAmount: val})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Valor da Parcela</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    value={debtForm.installmentAmount}
                    onChange={val => setDebtForm({...debtForm, installmentAmount: val})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Taxa de Juros % (Opcional)</label>
                  <input 
                    type="number" step="0.01"
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    placeholder="Ex: 12.5"
                    value={debtForm.interestRate || ''}
                    onChange={e => setDebtForm({...debtForm, interestRate: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Tipo</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all appearance-none"
                    value={debtForm.type}
                    onChange={e => setDebtForm({...debtForm, type: e.target.value as DebtType})}
                  >
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                    <option value="EMPRESTIMO">Empréstimo</option>
                    <option value="CHEQUE_ESPECIAL">Cheque Especial</option>
                    <option value="FINANCIAMENTO">Financiamento</option>
                    <option value="DIVIDA_INFORMAL">Dívida Informal</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Status</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all appearance-none"
                    value={debtForm.status}
                    onChange={e => setDebtForm({...debtForm, status: e.target.value as DebtStatus})}
                  >
                    <option value="ATIVA">Ativa (Não organizada)</option>
                    <option value="EM_PAGAMENTO">Em Pagamento</option>
                    <option value="EM_ESPERA">Em Espera</option>
                    <option value="QUITADA">Quitada</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Observação / Notas</label>
                <textarea 
                  className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all h-24 resize-none" 
                  placeholder="Detalhes sobre a dívida, acordos, etc..."
                  value={debtForm.observation}
                  onChange={e => setDebtForm({...debtForm, observation: e.target.value})}
                />
              </div>

              <button 
                onClick={handleSaveDebt}
                className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-2xl font-black text-[11px] uppercase shadow-2xl mt-4 active:scale-95 transition-all"
              >
                {editingDebt ? 'Salvar Alterações' : 'Cadastrar Dívida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      <ConfirmModal 
        isOpen={!!confirmDelete}
        title="Excluir Dívida"
        message="Tem certeza que deseja excluir esta dívida permanentemente? Esta ação não pode ser desfeita."
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default DebtAssistant;
