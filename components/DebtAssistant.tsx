
import React, { useState, useMemo, useEffect } from 'react';
import { Debt, Transaction, Wallet, UserSession, DebtType } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import MoneyInput from './MoneyInput';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { TrendingDown, AlertTriangle, CheckCircle2, ArrowRight, Calculator, Zap, Snowflake } from 'lucide-react';

interface DebtAssistantProps {
  uid: string;
  transactions: Transaction[];
  wallets: Wallet[];
  user: UserSession;
}

const DebtAssistant: React.FC<DebtAssistantProps> = ({ uid, transactions, wallets, user }) => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [extraPayment, setExtraPayment] = useState(0);

  // Form state for new debt
  const [newDebt, setNewDebt] = useState({
    name: '',
    totalAmount: 0,
    installmentAmount: 0,
    type: 'CARTAO_CREDITO' as DebtType,
    interestRate: 0,
    remainingInstallments: 0
  });

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "users", uid, "debts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Debt));
      setDebts(data);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const stats = useMemo(() => {
    const totalDebt = debts.reduce((acc, d) => acc + d.remainingAmount, 0);
    const initialDebt = debts.reduce((acc, d) => acc + d.totalAmount, 0);
    const totalInstallments = debts.reduce((acc, d) => acc + d.installmentAmount, 0);
    const monthlyIncome = user.incomeProfile?.totalExpectedMonthly || 0;
    
    const commitmentPercent = monthlyIncome > 0 ? (totalInstallments / monthlyIncome) * 100 : 0;
    
    let status: 'controlled' | 'attention' | 'critical' = 'controlled';
    if (commitmentPercent > 35) status = 'critical';
    else if (commitmentPercent > 20) status = 'attention';

    // Automatic exit plan
    const monthsToPayOff = totalInstallments > 0 ? totalDebt / totalInstallments : 0;
    const monthsToPayOffExtra = (totalInstallments + extraPayment) > 0 ? totalDebt / (totalInstallments + extraPayment) : 0;

    // Expense cut suggestions
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const highExpenseCategories = transactions
      .filter(t => t.type === 'EXPENSE' && new Date(t.date).getTime() > last30Days.getTime())
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

    const suggestions = Object.entries(highExpenseCategories)
      .map(([category, amount]) => ({
        category,
        amount: Number(amount),
        potentialSaving: Number(amount) * 0.5 // Suggest cutting 50%
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return {
      totalDebt,
      initialDebt,
      totalInstallments,
      monthlyIncome,
      commitmentPercent,
      status,
      monthsToPayOff,
      monthsToPayOffExtra,
      suggestions
    };
  }, [debts, user, extraPayment, transactions]);

  const handleAddDebt = async () => {
    if (!newDebt.name || newDebt.totalAmount <= 0 || newDebt.installmentAmount <= 0) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    await dispatchEvent(uid, {
      type: 'CREATE_DEBT',
      payload: newDebt,
      source: 'ui',
      createdAt: new Date()
    });

    setShowAddModal(false);
    setNewDebt({
      name: '',
      totalAmount: 0,
      installmentAmount: 0,
      type: 'CARTAO_CREDITO',
      interestRate: 0,
      remainingInstallments: 0
    });
  };

  const handleRegisterPayment = async () => {
    if (!showPaymentModal || !paymentAmount || !selectedWalletId) {
      alert("Preencha todos os campos.");
      return;
    }

    const amount = parseFloat(paymentAmount);
    const wallet = wallets.find(w => w.id === selectedWalletId);
    
    if (wallet && amount > wallet.balance) {
      alert("Saldo insuficiente na carteira selecionada.");
      return;
    }

    await dispatchEvent(uid, {
      type: 'REGISTER_DEBT_PAYMENT',
      payload: {
        debtId: showPaymentModal,
        amount,
        sourceWalletId: selectedWalletId,
        date: new Date().toISOString()
      },
      source: 'ui',
      createdAt: new Date()
    });

    setShowPaymentModal(null);
    setPaymentAmount('');
    setSelectedWalletId('');
  };

  const handleSetStrategy = async (debtId: string, strategy: 'SNOWBALL' | 'AVALANCHE') => {
    await dispatchEvent(uid, {
      type: 'UPDATE_DEBT',
      payload: { id: debtId, strategy },
      source: 'ui',
      createdAt: new Date()
    });
  };

  const handleDeleteDebt = async (id: string) => {
    if (window.confirm("Excluir esta dívida permanentemente?")) {
      await dispatchEvent(uid, {
        type: 'DELETE_DEBT',
        payload: { id },
        source: 'ui',
        createdAt: new Date()
      });
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse">Carregando assistente...</div>;

  if (debts.length === 0 && !showAddModal) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-8 animate-fade">
        <div className="text-center space-y-4 py-10">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} className="text-rose-500" />
          </div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Estou Endividado</h1>
          <p className="text-[var(--text-muted)] font-medium leading-relaxed">
            Não se preocupe, o primeiro passo para a liberdade financeira é o diagnóstico. 
            Vamos mapear suas dívidas e criar um plano real para você sair do vermelho.
          </p>
          
          <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-xl text-left space-y-6 mt-10">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest text-center">Diagnóstico Inicial</h3>
            <p className="text-[10px] text-[var(--text-muted)] text-center italic">Para começar, precisamos entender o tamanho do desafio.</p>
            
            <div className="space-y-4">
              <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] flex items-center gap-4">
                <div className="w-10 h-10 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-500 font-black">1</div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Mapeie cada uma das suas dívidas individualmente.</p>
              </div>
              <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-400/20 rounded-full flex items-center justify-center text-amber-500 font-black">2</div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Identifique as taxas de juros para priorizar o pagamento.</p>
              </div>
              <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] flex items-center gap-4">
                <div className="w-10 h-10 bg-[var(--green-whatsapp)]/20 rounded-full flex items-center justify-center text-[var(--green-whatsapp)] font-black">3</div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Crie um plano de ataque e acompanhe sua evolução.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowAddModal(true)}
              className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-[var(--green-whatsapp)]/20 hover:scale-[1.02] active:scale-95 transition-all mt-4"
            >
              Adicionar Minha Primeira Dívida
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-fade pb-32">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.4em] mb-1">Recuperação Financeira</h2>
          <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Estou Endividado</h1>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="text-[10px] font-black text-[var(--green-whatsapp)] border border-[var(--green-whatsapp)]/30 px-4 py-2 rounded-full uppercase hover:bg-[var(--green-whatsapp)]/10 transition-all"
        >
          + Nova Dívida
        </button>
      </header>

      {/* Resumo da Situação */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] p-6 rounded-[2rem] border border-[var(--border)] shadow-sm">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Dívida Total Restante</p>
          <h3 className="text-2xl font-black text-rose-500 italic">{format(stats.totalDebt)}</h3>
          <div className="mt-4 h-1.5 w-full bg-[var(--bg-body)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-rose-500 transition-all duration-1000" 
              style={{ width: `${stats.initialDebt > 0 ? ((stats.initialDebt - stats.totalDebt) / stats.initialDebt) * 100 : 0}%` }} 
            />
          </div>
          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase mt-2">
            {stats.initialDebt > 0 ? (((stats.initialDebt - stats.totalDebt) / stats.initialDebt) * 100).toFixed(1) : 0}% Pago
          </p>
        </div>

        <div className="bg-[var(--surface)] p-6 rounded-[2rem] border border-[var(--border)] shadow-sm">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Parcelas Mensais</p>
          <h3 className="text-2xl font-black text-[var(--text-primary)] italic">{format(stats.totalInstallments)}</h3>
          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase mt-2">{debts.length} Dívidas ativas</p>
        </div>

        <div className={`p-6 rounded-[2rem] border shadow-sm ${
          stats.status === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
          stats.status === 'attention' ? 'bg-amber-400/10 border-amber-400/20 text-amber-500' :
          'bg-[var(--green-whatsapp)]/10 border-[var(--green-whatsapp)]/20 text-[var(--green-whatsapp)]'
        }`}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1">Comprometimento da Renda</p>
          <h3 className="text-2xl font-black italic">{stats.commitmentPercent.toFixed(1)}%</h3>
          <p className="text-[8px] font-bold uppercase mt-2">
            {stats.status === 'critical' ? '⚠️ Situação Crítica' :
             stats.status === 'attention' ? '⚡ Atenção Necessária' :
             '✅ Situação Controlada'}
          </p>
        </div>
      </section>

      {/* Plano de Saída e Simulador */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <Calculator className="text-[var(--green-whatsapp)]" size={20} />
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Plano de Saída</h3>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase mb-2">Cenário Atual</p>
              <p className="text-sm font-medium leading-relaxed">
                Pagando <span className="font-black text-[var(--text-primary)]">{format(stats.totalInstallments)}</span> por mês, 
                sua dívida acaba em aproximadamente <span className="font-black text-rose-500">{Math.ceil(stats.monthsToPayOff)} meses</span>.
              </p>
            </div>

            <div className="p-4 bg-[var(--green-whatsapp)]/5 rounded-2xl border border-[var(--green-whatsapp)]/20">
              <p className="text-[10px] text-[var(--green-whatsapp)] font-bold uppercase mb-2">Simulador de Aceleração</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Aporte extra mensal:</span>
                  <span className="text-sm font-black text-[var(--green-whatsapp)]">{format(extraPayment)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="2000" 
                  step="50"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(Number(e.target.value))}
                  className="w-full h-1.5 bg-[var(--bg-body)] rounded-full appearance-none cursor-pointer accent-[var(--green-whatsapp)]"
                />
                <p className="text-sm font-medium leading-relaxed text-[var(--text-primary)]">
                  Se pagar <span className="font-black text-[var(--green-whatsapp)]">{format(stats.totalInstallments + extraPayment)}</span> por mês, 
                  sua dívida acaba em <span className="font-black text-[var(--green-whatsapp)]">{Math.ceil(stats.monthsToPayOffExtra)} meses</span>.
                  <br />
                  <span className="text-[10px] font-bold text-[var(--green-whatsapp)] uppercase">
                    Você economiza {Math.ceil(stats.monthsToPayOff - stats.monthsToPayOffExtra)} meses de juros!
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <TrendingDown className="text-rose-500" size={20} />
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Sugestão de Cortes</h3>
          </div>
          
          <div className="space-y-4">
            {stats.suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)]">
                <div>
                  <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">{s.category}</p>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Gasto atual: {format(s.amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase">Corte sugerido</p>
                  <p className="text-sm font-black text-[var(--green-whatsapp)]">+{format(s.potentialSaving)}</p>
                </div>
              </div>
            ))}
            <p className="text-[9px] text-[var(--text-muted)] font-medium italic text-center">
              Reduzindo esses gastos pela metade, você libera <span className="font-black text-[var(--green-whatsapp)]">{format(stats.suggestions.reduce((acc, s) => acc + s.potentialSaving, 0))}</span> extras por mês.
            </p>
          </div>
        </div>
      </section>

      {/* Estratégias */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] p-6 rounded-[2rem] border border-[var(--border)] shadow-sm hover:border-[var(--green-whatsapp)] transition-all cursor-pointer group">
          <div className="flex items-center gap-3 mb-4">
            <Snowflake className="text-blue-400" size={20} />
            <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Método Bola de Neve</h4>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            Foque em pagar primeiro as <span className="font-bold text-[var(--text-primary)]">menores dívidas</span>. 
            Isso gera vitórias rápidas e motivação psicológica para continuar o plano.
          </p>
        </div>

        <div className="bg-[var(--surface)] p-6 rounded-[2rem] border border-[var(--border)] shadow-sm hover:border-rose-500 transition-all cursor-pointer group">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="text-amber-400" size={20} />
            <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest">Método Avalanche</h4>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            Foque em pagar primeiro as dívidas com <span className="font-bold text-[var(--text-primary)]">maiores juros</span>. 
            Matematicamente, é a forma mais barata e rápida de quitar tudo.
          </p>
        </div>
      </section>

      {/* Lista de Dívidas */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic px-1">Suas Dívidas Ativas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debts.map(debt => {
            const pct = ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100;
            return (
              <div key={debt.id} className="bg-[var(--surface)] p-6 rounded-[2rem] border border-[var(--border)] shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-black text-[var(--text-primary)] uppercase italic">{debt.name}</h4>
                    <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">{debt.type.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowPaymentModal(debt.id)}
                      className="bg-[var(--text-primary)] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:scale-105 transition-all"
                    >
                      Pagar
                    </button>
                    <button 
                      onClick={() => handleDeleteDebt(debt.id)}
                      className="p-2 text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black">
                    <span className="text-[var(--text-muted)] uppercase">Restante: {format(debt.remainingAmount)}</span>
                    <span className="text-[var(--text-primary)]">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full bg-[var(--bg-body)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--green-whatsapp)] transition-all duration-1000" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-[var(--text-muted)] uppercase">
                    <span>Parcela: {format(debt.installmentAmount)}</span>
                    <span>Total: {format(debt.totalAmount)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal Adicionar Dívida */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative animate-fade max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowAddModal(false)} className="absolute top-10 right-10 text-[var(--text-muted)] font-black text-xl">✕</button>
            <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic mb-2 text-center">Diagnóstico de Dívida</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-black uppercase mb-8 text-center tracking-widest opacity-60 italic">Seja honesto com seus números</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Nome da Dívida</label>
                <input 
                  className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                  placeholder="Ex: Empréstimo Banco X"
                  value={newDebt.name}
                  onChange={e => setNewDebt({...newDebt, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Valor Total</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    value={newDebt.totalAmount}
                    onChange={val => setNewDebt({...newDebt, totalAmount: val})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Valor Parcela</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    value={newDebt.installmentAmount}
                    onChange={val => setNewDebt({...newDebt, installmentAmount: val})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Tipo da Dívida</label>
                <select 
                  className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all appearance-none"
                  value={newDebt.type}
                  onChange={e => setNewDebt({...newDebt, type: e.target.value as DebtType})}
                >
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                  <option value="EMPRESTIMO">Empréstimo</option>
                  <option value="CHEQUE_ESPECIAL">Cheque Especial</option>
                  <option value="FINANCIAMENTO">Financiamento</option>
                  <option value="DIVIDA_INFORMAL">Dívida Informal</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Taxa Juros % (Opcional)</label>
                  <input 
                    type="number"
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    placeholder="0.00"
                    value={newDebt.interestRate || ''}
                    onChange={e => setNewDebt({...newDebt, interestRate: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Parcelas Restantes</label>
                  <input 
                    type="number"
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    placeholder="0"
                    value={newDebt.remainingInstallments || ''}
                    onChange={e => setNewDebt({...newDebt, remainingInstallments: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <button 
                onClick={handleAddDebt}
                className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-2xl font-black text-[11px] uppercase shadow-2xl mt-4 active:scale-95 transition-all"
              >
                Salvar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Pagamento */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[var(--surface)] w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative animate-fade">
            <button onClick={() => setShowPaymentModal(null)} className="absolute top-10 right-10 text-[var(--text-muted)] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-6 text-center">Registrar Pagamento</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Valor Pago</label>
                <MoneyInput 
                  className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                  value={Number(paymentAmount) || 0}
                  onChange={val => setPaymentAmount(val.toString())}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Origem do Dinheiro</label>
                <div className="grid grid-cols-2 gap-2">
                  {wallets.map(w => (
                    <button 
                      key={w.id}
                      onClick={() => setSelectedWalletId(w.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${selectedWalletId === w.id ? 'bg-[var(--green-whatsapp)] border-[var(--green-whatsapp)] text-white' : 'bg-[var(--bg-body)] border-[var(--border)] text-[var(--text-primary)]'}`}
                    >
                      <p className="text-[10px] font-black uppercase truncate">{w.name}</p>
                      <p className="text-[8px] font-bold opacity-70">{format(w.balance)}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleRegisterPayment}
                className="w-full bg-[var(--text-primary)] text-white py-5 rounded-2xl font-black text-[11px] uppercase shadow-2xl mt-4 active:scale-95 transition-all"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtAssistant;
