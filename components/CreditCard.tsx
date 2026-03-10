
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, CreditCardInfo, Wallet } from '../types';
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, query, doc } from 'firebase/firestore';
import { dispatchEvent } from '../services/eventDispatcher';
import MoneyInput from './MoneyInput';

interface CreditCardProps {
  transactions: Transaction[];
  uid: string;
  cards: CreditCardInfo[];
  wallets: Wallet[];
  loading?: boolean;
}

const CreditCard: React.FC<CreditCardProps> = ({ transactions, uid, cards, wallets, loading }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showExtrato, setShowExtrato] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form States
  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardDueDay, setCardDueDay] = useState('10');
  const [cardClosingDay, setCardClosingDay] = useState('5');

  // Payment Modal States
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payCycle, setPayCycle] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  const cardAnalysis = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return cards.map(card => {
      const closingDay = card.closingDay || 5;
      
      // Determina os ciclos
      const currentCycleDate = new Date(currentYear, currentMonth, 1);
      const currentCycle = `${currentCycleDate.getFullYear()}-${String(currentCycleDate.getMonth() + 1).padStart(2, '0')}`;
      
      const nextCycleDate = new Date(currentYear, currentMonth + 1, 1);
      const nextCycle = `${nextCycleDate.getFullYear()}-${String(nextCycleDate.getMonth() + 1).padStart(2, '0')}`;

      // Filtramos transações
      const allCardExpenses = transactions.filter(t => 
        t.cardId === card.id || 
        (t.paymentMethod === 'CARD' && (!t.cardId || t.cardId === 'default') && cards[0]?.id === card.id)
      );
      
      const currentInvoiceExpenses = allCardExpenses.filter(t => t.invoiceCycle === currentCycle);
      const nextInvoiceExpenses = allCardExpenses.filter(t => t.invoiceCycle === nextCycle);

      const currentAmount = currentInvoiceExpenses.filter(t => !t.isPaid).reduce((sum, t) => sum + t.amount, 0);
      const nextAmount = nextInvoiceExpenses.filter(t => !t.isPaid).reduce((sum, t) => sum + t.amount, 0);

      const used = Number(card.usedAmount) || 0;
      const limit = Number(card.limit) || 0;
      const available = Number(card.availableAmount) || 0;
      const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
      
      return { 
        ...card, 
        used, 
        available, 
        limit, 
        pct, 
        expenses: allCardExpenses,
        currentCycle,
        nextCycle,
        currentAmount,
        nextAmount,
        currentInvoiceExpenses,
        nextInvoiceExpenses
      };
    });
  }, [cards, transactions]);

  const handleAddCard = async () => {
    if (!cardName || !cardLimit || !cardDueDay) return;
    setIsLoading(true);
    const res = await dispatchEvent(uid, {
      type: 'ADD_CARD',
      payload: { 
        name: cardName, 
        bank: cardBank, 
        limit: parseFloat(cardLimit),
        dueDay: parseInt(cardDueDay),
        closingDay: cardClosingDay ? parseInt(cardClosingDay) : null
      },
      source: 'ui',
      createdAt: new Date()
    });
    if (res.success) {
      setCardName(''); setCardBank(''); setCardLimit(''); setCardDueDay('10'); setCardClosingDay('');
      setShowAddForm(false);
    } else {
      alert("Erro ao adicionar cartão: " + (res.error || "Erro desconhecido"));
    }
    setIsLoading(false);
  };

  const handleUpdateCard = async (cardId: string, newLimit: number, newDueDay: number, newClosingDay: number) => {
    setIsLoading(true);
    const res = await dispatchEvent(uid, {
      type: 'UPDATE_CARD',
      payload: { id: cardId, limit: newLimit, dueDay: newDueDay, closingDay: newClosingDay },
      source: 'ui',
      createdAt: new Date()
    });
    if (res.success) {
      setIsEditing(null);
    } else {
      alert("Erro ao atualizar cartão.");
    }
    setIsLoading(false);
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!window.confirm("Deseja realmente excluir este cartão?")) return;
    await dispatchEvent(uid, {
      type: 'DELETE_CARD',
      payload: { id: cardId },
      source: 'ui',
      createdAt: new Date()
    });
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm("Deseja excluir este lançamento do cartão?")) return;
    await dispatchEvent(uid, {
      type: 'DELETE_ITEM',
      payload: { id, collection: 'transactions' },
      source: 'ui',
      createdAt: new Date()
    });
  };

  const handleOpenPayment = (card: any, cycle: string, amount: number) => {
    if (amount <= 0) {
      alert("Fatura zerada. Parabéns!");
      return;
    }
    setPayAmount(amount.toString());
    setPayCycle(cycle);
    setIsPaying(card.id);
  };

  const handleConfirmPayment = async () => {
    const amount = parseFloat(payAmount);
    const card = cardAnalysis.find(c => c.id === isPaying);
    
    if (!card || isNaN(amount) || amount <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    if (!selectedWalletId) {
      alert("Por favor, selecione de onde sairá o dinheiro.");
      return;
    }

    const wallet = wallets.find(w => w.id === selectedWalletId);
    if (wallet && amount > wallet.balance) {
      alert(`Saldo insuficiente na carteira ${wallet.name}! Você tem ${format(wallet.balance)} disponível.`);
      return;
    }

    setIsLoading(true);
    const res = await dispatchEvent(uid, {
      type: 'PAY_CARD',
      payload: { 
        cardId: card.id, 
        cardName: card.name, 
        amount: amount,
        date: payDate,
        cycle: payCycle,
        sourceWalletId: selectedWalletId
      },
      source: 'ui',
      createdAt: new Date()
    });

    if (res.success) {
      setIsPaying(null);
      setPayAmount('');
      setPayCycle('');
      setSelectedWalletId(null);
    } else {
      alert("Erro ao processar pagamento.");
    }
    setIsLoading(false);
  };

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-20 bg-white/50 rounded-3xl"></div>
        <div className="h-64 bg-white/50 rounded-[3rem]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade pb-32">
      <header className="mb-4">
        <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Gestão de Crédito</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Carteira Digital</h1>
      </header>

      {cardAnalysis.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-[var(--surface)] rounded-[3rem] border border-dashed border-[var(--border)]">
          <div className="text-6xl grayscale opacity-20">💳</div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-[var(--green-whatsapp)] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all"
          >
            Configurar Cartão
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Cartões Ativos</h3>
            <button onClick={() => setShowAddForm(true)} className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-tighter">Novo Cartão</button>
          </div>

          {cardAnalysis.map(card => (
            <div key={card.id} className="bg-gradient-to-br from-[var(--surface)] via-[var(--bg-body)] to-[var(--surface)] p-8 rounded-[3rem] shadow-2xl relative overflow-hidden text-[var(--text-primary)] group border border-[var(--border)]">
              {/* Pattern Decoração */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--green-whatsapp)]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h4 className="text-2xl font-black italic uppercase tracking-tighter leading-none">{card.name}</h4>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase mt-1 tracking-widest">{card.bank || 'Bandeira Digital'}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setShowExtrato(card.id)} className="p-2.5 bg-[var(--surface)]/50 rounded-xl hover:bg-[var(--surface)] transition-all text-[10px] font-black uppercase tracking-tighter border border-[var(--border)]">📄 Extrato</button>
                    <button onClick={() => setIsEditing(card.id)} className="p-2.5 bg-[var(--surface)]/50 rounded-xl hover:bg-[var(--surface)] transition-all text-xs border border-[var(--border)]">✏️</button>
                    <button onClick={() => handleDeleteCard(card.id)} className="p-2.5 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-all text-red-400 text-xs border border-red-500/20">🗑️</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-4">
                    <div className="p-4 bg-[var(--bg-body)]/50 rounded-3xl border border-[var(--border)]">
                      <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Fatura Atual ({card.currentCycle})</p>
                      <div className="flex justify-between items-end">
                        <h3 className="text-3xl font-black text-rose-500">{format(card.currentAmount)}</h3>
                        <button 
                          onClick={() => handleOpenPayment(card, card.currentCycle, card.currentAmount)}
                          className="bg-[var(--green-whatsapp)] hover:bg-[var(--green-whatsapp-dark)] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95"
                        >
                          Pagar
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <span className="w-1.5 h-1.5 bg-[var(--green-whatsapp)] rounded-full animate-pulse"></span>
                        <p className="text-[9px] text-[var(--green-whatsapp)] font-black uppercase italic">Vence dia {card.dueDay} • Fecha dia {card.closingDay}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--bg-body)]/30 rounded-3xl border border-[var(--border)] opacity-80">
                      <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Próxima Fatura ({card.nextCycle})</p>
                      <div className="flex justify-between items-end">
                        <h3 className="text-2xl font-black text-[var(--text-primary)]">{format(card.nextAmount)}</h3>
                        <button 
                          onClick={() => handleOpenPayment(card, card.nextCycle, card.nextAmount)}
                          className="bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--text-primary)] px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 border border-[var(--border)]"
                        >
                          Pagar
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="bg-[var(--bg-body)]/50 p-6 rounded-3xl border border-[var(--border)]">
                      <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Resumo de Limite</p>
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-tight mb-2">
                        <span className="text-[var(--text-muted)]">Livre: {format(card.available)}</span>
                        <span className="text-[var(--text-primary)]">Total: {format(card.limit)}</span>
                      </div>
                      <div className="h-2.5 w-full bg-[var(--bg-body)] rounded-full overflow-hidden flex mb-2">
                        <div 
                          className={`h-full transition-all duration-1000 ${card.pct > 90 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : card.pct > 70 ? 'bg-amber-400' : 'bg-[var(--green-whatsapp)]'}`}
                          style={{ width: `${card.pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{card.pct.toFixed(1)}% utilizado</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Edição Rápida */}
              {isEditing === card.id && (
                <div className="absolute inset-0 bg-[var(--surface)]/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 z-20 animate-fade">
                  <h4 className="text-[10px] font-black uppercase mb-8 tracking-[0.3em] text-[var(--green-whatsapp)]">Ajustes do Cartão</h4>
                  
                  <div className="w-full space-y-6 mb-10">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Novo Limite Total</label>
                      <MoneyInput 
                        className="bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-5 w-full text-center text-2xl font-black outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all"
                        value={card.limit}
                        onChange={(val) => {
                          const input = document.getElementById(`limit-edit-${card.id}`) as HTMLInputElement;
                          if (input) input.value = val.toString();
                        }}
                        id={`limit-edit-${card.id}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Dia de Fechamento</label>
                      <select 
                        id={`closing-edit-${card.id}`}
                        className="bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-5 w-full text-center text-lg font-black outline-none appearance-none text-[var(--text-primary)] focus:border-[var(--green-whatsapp)] transition-all"
                        defaultValue={card.closingDay}
                      >
                        {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                          <option key={d} value={d} className="bg-[var(--surface)]">{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Dia de Vencimento</label>
                      <select 
                        id={`day-edit-${card.id}`}
                        className="bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-5 w-full text-center text-lg font-black outline-none appearance-none text-[var(--text-primary)] focus:border-[var(--green-whatsapp)] transition-all"
                        defaultValue={card.dueDay}
                      >
                        {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                          <option key={d} value={d} className="bg-[var(--surface)]">{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full">
                    <button onClick={() => setIsEditing(null)} className="flex-1 py-5 text-[10px] font-black uppercase bg-[var(--bg-body)] rounded-2xl hover:bg-[var(--surface)] transition-all text-[var(--text-muted)] border border-[var(--border)]">Cancelar</button>
                    <button 
                      disabled={isLoading}
                      onClick={() => {
                        const val = (document.getElementById(`limit-edit-${card.id}`) as HTMLInputElement).value;
                        const day = (document.getElementById(`day-edit-${card.id}`) as HTMLSelectElement).value;
                        const closing = (document.getElementById(`closing-edit-${card.id}`) as HTMLSelectElement).value;
                        handleUpdateCard(card.id, parseFloat(val), parseInt(day), parseInt(closing));
                      }}
                      className="flex-1 py-5 text-[10px] font-black uppercase bg-[var(--green-whatsapp)] text-white rounded-2xl shadow-lg shadow-[var(--green-whatsapp)]/20"
                    >
                      {isLoading ? '...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Pagamento (Fatura) */}
      {isPaying && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[var(--surface)] w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl relative animate-fade max-h-[90vh] overflow-y-auto pr-1">
            <button onClick={() => setIsPaying(null)} className="absolute top-10 right-10 text-[var(--text-muted)] font-black text-xl hover:scale-110 transition-transform">✕</button>
            <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic mb-1 text-center tracking-tighter">Liquidar Débito</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-black uppercase mb-6 text-center tracking-widest italic opacity-60">Sincronizado com Dashboard</p>
            
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Valor do Pagamento</label>
                <div className="relative">
                  <MoneyInput 
                    autoFocus
                    className="w-full bg-[var(--bg-body)] rounded-3xl p-8 text-3xl font-black text-center outline-none border-2 border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    placeholder="R$ 0,00"
                    value={Number(payAmount) || 0} 
                    onChange={val => setPayAmount(val.toString())} 
                  />
                </div>
                <div className="flex justify-center gap-2 mt-4">
                   <button 
                    onClick={() => setPayAmount(cardAnalysis.find(c => c.id === isPaying)?.used?.toString() || '0')}
                    className="text-[9px] font-black text-[var(--green-whatsapp)] uppercase border border-[var(--green-whatsapp)]/20 px-3 py-1.5 rounded-full hover:bg-emerald-50 transition-colors"
                   >
                     Total: {format(cardAnalysis.find(c => c.id === isPaying)?.used || 0)}
                   </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 text-center">De onde sairá o dinheiro?</p>
                <div className="grid grid-cols-2 gap-2">
                  {wallets.map(w => (
                    <button 
                      key={w.id}
                      onClick={() => setSelectedWalletId(w.id)}
                      className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${selectedWalletId === w.id ? 'bg-[var(--green-whatsapp)] border-[var(--green-whatsapp)] text-white shadow-lg scale-105' : 'bg-[var(--bg-body)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--green-whatsapp)]'}`}
                    >
                      <span className="text-xl">{w.icon || '💰'}</span>
                      <span className="text-[9px] font-black uppercase truncate w-full">{w.name}</span>
                      <span className={`text-[8px] font-bold ${selectedWalletId === w.id ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>{format(w.balance)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1 tracking-widest">Data Efetiva</label>
                <input 
                  type="date"
                  className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                  value={payDate} 
                  onChange={e => setPayDate(e.target.value)} 
                />
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={isLoading || !selectedWalletId}
                className="w-full bg-[var(--text-primary)] text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase shadow-2xl mt-6 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>⚡ Confirmar Pagamento</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro de Novo Cartão */}
      {showAddForm && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[var(--surface)] w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl animate-fade relative">
            <button onClick={() => setShowAddForm(false)} className="absolute top-10 right-10 text-[var(--text-muted)] font-black text-xl hover:scale-110 transition-transform">✕</button>
            <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic mb-8 text-center tracking-tighter">Novo Cartão</h3>
            
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Identificação</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" placeholder="Ex: Nubank, Inter..." value={cardName} onChange={e => setCardName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Instituição (Opcional)</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" placeholder="Ex: Banco Itaú" value={cardBank} onChange={e => setCardBank(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Limite R$</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all" 
                    placeholder="R$ 0,00" 
                    value={Number(cardLimit) || 0} 
                    onChange={val => setCardLimit(val.toString())} 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Dia Fech.</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all appearance-none"
                    value={cardClosingDay}
                    onChange={e => setCardClosingDay(e.target.value)}
                  >
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Dia Venc.</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-5 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] transition-all appearance-none"
                    value={cardDueDay}
                    onChange={e => setCardDueDay(e.target.value)}
                  >
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={handleAddCard} disabled={isLoading} className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase shadow-xl mt-4 active:scale-95 transition-all">
                {isLoading ? 'Configurando...' : '✨ Salvar e Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Extrato Detalhado */}
      {showExtrato && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[var(--bg-body)] w-full max-w-md rounded-[3.5rem] p-8 shadow-2xl animate-fade max-h-[85vh] flex flex-col relative">
            <button onClick={() => setShowExtrato(null)} className="absolute top-8 right-8 text-[var(--text-muted)] font-black text-xl z-10">✕</button>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-8 flex items-center gap-3 tracking-tighter">
              <span className="w-8 h-8 bg-[var(--text-primary)] text-white flex items-center justify-center rounded-xl text-xs not-italic">GB</span>
              Extrato: {cardAnalysis.find(c => c.id === showExtrato)?.name}
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {cardAnalysis.find(c => c.id === showExtrato)?.expenses.length === 0 ? (
                <div className="text-center py-20 opacity-30 italic text-xs font-bold uppercase tracking-widest">Nenhum gasto registrado</div>
              ) : (
                cardAnalysis.find(c => c.id === showExtrato)?.expenses
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(t => (
                    <div key={t.id} className="bg-[var(--surface)] p-5 rounded-3xl flex justify-between items-center shadow-sm border border-[var(--border)]/30 relative overflow-hidden group">
                      {t.isPaid && <div className="absolute top-0 left-0 w-1 h-full bg-[var(--green-whatsapp)]"></div>}
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${t.isPaid ? 'text-gray-400 line-through' : 'text-[var(--text-primary)]'}`}>{t.description || 'Gasto no Cartão'}</p>
                        <p className="text-[9px] text-[var(--text-muted)] uppercase font-bold mt-0.5">
                          {t.category} • {new Date(t.date).toLocaleDateString()}
                          <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-[8px]">{t.invoiceCycle || 'Sem Ciclo'}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black ${t.isPaid ? 'text-gray-300' : 'text-red-500'}`}>-{format(t.amount)}</span>
                        {t.isPaid ? (
                          <p className="text-[8px] font-black text-[var(--green-whatsapp)] uppercase mt-1">Liquidado</p>
                        ) : (
                          <button 
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="text-[8px] font-black text-red-400 uppercase mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
            
            <div className="mt-8 bg-[var(--text-primary)] p-6 rounded-[2.5rem] text-white flex justify-between items-center shadow-xl">
               <div>
                 <p className="text-[9px] font-black uppercase text-gray-400">Total Aberto</p>
                 <p className="text-xl font-black">{format(cardAnalysis.find(c => c.id === showExtrato)?.used || 0)}</p>
               </div>
               <button 
                 onClick={() => {
                   const c = cardAnalysis.find(c => c.id === showExtrato);
                   if (c) handleOpenPayment(c, '', c.used);
                   setShowExtrato(null);
                 }}
                 className="bg-[var(--green-whatsapp)] text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg"
               >
                 Liquidar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditCard;
