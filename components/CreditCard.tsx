
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, CreditCardInfo } from '../types';
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, query, doc } from 'firebase/firestore';
import { dispatchEvent } from '../services/eventDispatcher';

interface CreditCardProps {
  transactions: Transaction[];
  uid: string;
}

const CreditCard: React.FC<CreditCardProps> = ({ transactions, uid }) => {
  const [cards, setCards] = useState<CreditCardInfo[]>([]);
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
  const [cardClosingDay, setCardClosingDay] = useState('');

  // Payment Modal States
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, "users", uid, "cards"), (snap) => {
      setCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as CreditCardInfo)));
    });
    return unsub;
  }, [uid]);

  const cardAnalysis = useMemo(() => {
    return cards.map(card => {
      // Usamos os valores salvos no documento para a UI principal (Vida Real)
      const used = Number(card.usedAmount) || 0;
      const limit = Number(card.limit) || 0;
      const available = Number(card.availableAmount) || 0;
      const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
      
      // Filtramos transações apenas para o extrato detalhado
      const allCardExpenses = transactions.filter(t => t.cardId === card.id || (t.paymentMethod === 'CARD' && !t.cardId));
      
      return { ...card, used, available, limit, pct, expenses: allCardExpenses };
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
    }
    setIsLoading(false);
  };

  const handleUpdateCard = async (cardId: string, newLimit: number, newDueDay: number) => {
    setIsLoading(true);
    await dispatchEvent(uid, {
      type: 'UPDATE_CARD',
      payload: { id: cardId, limit: newLimit, dueDay: newDueDay },
      source: 'ui',
      createdAt: new Date()
    });
    setIsEditing(null);
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

  const handleOpenPayment = (card: any) => {
    if (card.used <= 0) {
      alert("Fatura zerada. Parabéns!");
      return;
    }
    setPayAmount(card.used.toString());
    setIsPaying(card.id);
  };

  const handleConfirmPayment = async () => {
    const amount = parseFloat(payAmount);
    const card = cardAnalysis.find(c => c.id === isPaying);
    
    if (!card || isNaN(amount) || amount <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    setIsLoading(true);
    const res = await dispatchEvent(uid, {
      type: 'PAY_CARD',
      payload: { 
        cardId: card.id, 
        cardName: card.name, 
        amount: amount,
        date: payDate
      },
      source: 'ui',
      createdAt: new Date()
    });

    if (res.success) {
      setIsPaying(null);
      setPayAmount('');
    } else {
      alert("Erro ao processar pagamento.");
    }
    setIsLoading(false);
  };

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="p-6 space-y-6 animate-fade pb-32">
      <header className="mb-4">
        <h2 className="text-[10px] font-black text-[#00a884] uppercase tracking-[0.4em] mb-1">Gestão de Crédito</h2>
        <h1 className="text-3xl font-black text-[#111b21] uppercase italic tracking-tighter">Carteira Digital</h1>
      </header>

      {cardAnalysis.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-white rounded-[3rem] border border-dashed border-[#d1d7db]">
          <div className="text-6xl grayscale opacity-20">💳</div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-[#00a884] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all"
          >
            Configurar Cartão
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[10px] font-black text-[#667781] uppercase tracking-widest">Cartões Ativos</h3>
            <button onClick={() => setShowAddForm(true)} className="text-[10px] font-black text-[#00a884] uppercase tracking-tighter">Novo Cartão</button>
          </div>

          {cardAnalysis.map(card => (
            <div key={card.id} className="bg-gradient-to-br from-[#111b21] via-[#202c33] to-[#111b21] p-8 rounded-[3rem] shadow-2xl relative overflow-hidden text-white group">
              {/* Pattern Decoração */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#00a884]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h4 className="text-2xl font-black italic uppercase tracking-tighter leading-none">{card.name}</h4>
                    <p className="text-[10px] text-[#8696a0] font-bold uppercase mt-1 tracking-widest">{card.bank || 'Bandeira Digital'}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setIsEditing(card.id)} className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all text-xs">✏️</button>
                    <button onClick={() => handleDeleteCard(card.id)} className="p-2.5 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-all text-red-400 text-xs">🗑️</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-[#8696a0] uppercase tracking-widest">Fatura Atual</p>
                    <h3 className="text-4xl font-black text-[#ff4b4b]">{format(card.used)}</h3>
                    <div className="flex items-center gap-2 pt-1">
                       <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-pulse"></span>
                       <p className="text-[10px] text-[#00a884] font-black uppercase italic">Vence dia {card.dueDay}</p>
                    </div>
                  </div>
                  <div className="flex flex-col justify-end md:items-end">
                    <button 
                      onClick={() => handleOpenPayment(card)}
                      className="bg-[#00a884] hover:bg-[#00c99d] text-white px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase shadow-xl shadow-[#00a884]/20 transition-all active:scale-95 w-full md:w-auto"
                    >
                      Pagar Fatura
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/5">
                  <div className="flex justify-between text-[11px] font-black uppercase tracking-tight">
                    <span className="text-[#8696a0]">Disponível: {format(card.available)}</span>
                    <span className="text-white">Limite: {format(card.limit)}</span>
                  </div>
                  
                  <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full transition-all duration-1000 ${card.pct > 90 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : card.pct > 70 ? 'bg-amber-400' : 'bg-[#00a884]'}`}
                      style={{ width: `${card.pct}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                     <p className="text-[10px] text-[#8696a0] font-bold uppercase">{card.pct.toFixed(1)}% do limite utilizado</p>
                     <button 
                      onClick={() => setShowExtrato(card.id)}
                      className="bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-colors"
                     >
                       Ver Extrato
                     </button>
                  </div>
                </div>
              </div>

              {/* Modal Edição Rápida */}
              {isEditing === card.id && (
                <div className="absolute inset-0 bg-[#111b21]/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 z-20 animate-fade">
                  <h4 className="text-[10px] font-black uppercase mb-8 tracking-[0.3em] text-[#00a884]">Ajustes do Cartão</h4>
                  
                  <div className="w-full space-y-6 mb-10">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[#8696a0] uppercase ml-1">Novo Limite Total</label>
                      <input 
                        type="number"
                        className="bg-white/5 border border-white/10 rounded-2xl p-5 w-full text-center text-2xl font-black outline-none focus:border-[#00a884] text-white transition-all"
                        defaultValue={card.limit}
                        id={`limit-edit-${card.id}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[#8696a0] uppercase ml-1">Dia de Vencimento</label>
                      <select 
                        id={`day-edit-${card.id}`}
                        className="bg-white/5 border border-white/10 rounded-2xl p-5 w-full text-center text-lg font-black outline-none appearance-none text-white focus:border-[#00a884] transition-all"
                        defaultValue={card.dueDay}
                      >
                        {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                          <option key={d} value={d} className="bg-[#111b21]">{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full">
                    <button onClick={() => setIsEditing(null)} className="flex-1 py-5 text-[10px] font-black uppercase bg-white/5 rounded-2xl hover:bg-white/10 transition-all">Cancelar</button>
                    <button 
                      disabled={isLoading}
                      onClick={() => {
                        const val = (document.getElementById(`limit-edit-${card.id}`) as HTMLInputElement).value;
                        const day = (document.getElementById(`day-edit-${card.id}`) as HTMLSelectElement).value;
                        handleUpdateCard(card.id, parseFloat(val), parseInt(day));
                      }}
                      className="flex-1 py-5 text-[10px] font-black uppercase bg-[#00a884] rounded-2xl shadow-lg shadow-[#00a884]/20"
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
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl relative animate-fade">
            <button onClick={() => setIsPaying(null)} className="absolute top-10 right-10 text-[#667781] font-black text-xl hover:scale-110 transition-transform">✕</button>
            <h3 className="text-2xl font-black text-[#111b21] uppercase italic mb-1 text-center tracking-tighter">Liquidar Débito</h3>
            <p className="text-[10px] text-[#667781] font-black uppercase mb-10 text-center tracking-widest italic opacity-60">Sincronizado com Dashboard</p>
            
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <label className="text-[9px] font-black text-[#667781] uppercase tracking-widest">Valor do Pagamento</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[#111b21] font-black text-xl">R$</span>
                  <input 
                    type="number" 
                    autoFocus
                    className="w-full bg-[#f0f2f5] rounded-3xl p-8 text-3xl font-black text-center outline-none border-2 border-transparent focus:border-[#00a884] transition-all" 
                    value={payAmount} 
                    onChange={e => setPayAmount(e.target.value)} 
                  />
                </div>
                <div className="flex justify-center gap-2 mt-4">
                   <button 
                    onClick={() => setPayAmount(cardAnalysis.find(c => c.id === isPaying)?.used.toString() || '0')}
                    className="text-[9px] font-black text-[#00a884] uppercase border border-[#00a884]/20 px-3 py-1.5 rounded-full hover:bg-emerald-50 transition-colors"
                   >
                     Total: {format(cardAnalysis.find(c => c.id === isPaying)?.used || 0)}
                   </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-[#667781] uppercase ml-1 tracking-widest">Data Efetiva</label>
                <input 
                  type="date"
                  className="w-full bg-[#f0f2f5] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[#00a884] transition-all" 
                  value={payDate} 
                  onChange={e => setPayDate(e.target.value)} 
                />
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={isLoading}
                className="w-full bg-[#111b21] text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase shadow-2xl mt-6 active:scale-95 transition-all flex items-center justify-center gap-3"
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
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl animate-fade relative">
            <button onClick={() => setShowAddForm(false)} className="absolute top-10 right-10 text-[#667781] font-black text-xl hover:scale-110 transition-transform">✕</button>
            <h3 className="text-2xl font-black text-[#111b21] uppercase italic mb-8 text-center tracking-tighter">Novo Cartão</h3>
            
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Identificação</label>
                <input className="w-full bg-[#f0f2f5] rounded-2xl p-5 text-sm font-bold outline-none border border-transparent focus:border-[#00a884] transition-all" placeholder="Ex: Nubank, Inter..." value={cardName} onChange={e => setCardName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Instituição (Opcional)</label>
                <input className="w-full bg-[#f0f2f5] rounded-2xl p-5 text-sm font-bold outline-none border border-transparent focus:border-[#00a884] transition-all" placeholder="Ex: Banco Itaú" value={cardBank} onChange={e => setCardBank(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Limite R$</label>
                  <input type="number" className="w-full bg-[#f0f2f5] rounded-2xl p-5 text-sm font-bold outline-none border border-transparent focus:border-[#00a884] transition-all" placeholder="0,00" value={cardLimit} onChange={e => setCardLimit(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Dia Venc.</label>
                  <select 
                    className="w-full bg-[#f0f2f5] rounded-2xl p-5 text-sm font-bold outline-none border border-transparent focus:border-[#00a884] transition-all appearance-none"
                    value={cardDueDay}
                    onChange={e => setCardDueDay(e.target.value)}
                  >
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={handleAddCard} disabled={isLoading} className="w-full bg-[#00a884] text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase shadow-xl mt-4 active:scale-95 transition-all">
                {isLoading ? 'Configurando...' : '✨ Salvar e Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Extrato Detalhado */}
      {showExtrato && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#f0f2f5] w-full max-w-md rounded-[3.5rem] p-8 shadow-2xl animate-fade max-h-[85vh] flex flex-col relative overflow-hidden">
            <button onClick={() => setShowExtrato(null)} className="absolute top-8 right-8 text-[#667781] font-black text-xl z-10">✕</button>
            <h3 className="text-xl font-black text-[#111b21] uppercase italic mb-8 flex items-center gap-3 tracking-tighter">
              <span className="w-8 h-8 bg-[#111b21] text-white flex items-center justify-center rounded-xl text-xs not-italic">GB</span>
              Extrato do Ciclo
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-1">
              {cardAnalysis.find(c => c.id === showExtrato)?.expenses.length === 0 ? (
                <div className="text-center py-20 opacity-30 italic text-xs font-bold uppercase tracking-widest">Nenhum gasto registrado</div>
              ) : (
                cardAnalysis.find(c => c.id === showExtrato)?.expenses
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(t => (
                    <div key={t.id} className="bg-white p-5 rounded-3xl flex justify-between items-center shadow-sm border border-white relative overflow-hidden">
                      {t.isPaid && <div className="absolute top-0 left-0 w-1 h-full bg-[#00a884]"></div>}
                      <div>
                        <p className={`text-sm font-bold ${t.isPaid ? 'text-gray-400 line-through' : 'text-[#111b21]'}`}>{t.description}</p>
                        <p className="text-[9px] text-[#667781] uppercase font-bold mt-0.5">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black ${t.isPaid ? 'text-gray-300' : 'text-red-500'}`}>-{format(t.amount)}</span>
                        {t.isPaid && <p className="text-[8px] font-black text-[#00a884] uppercase mt-1">Liquidado</p>}
                      </div>
                    </div>
                  ))
              )}
            </div>
            
            <div className="mt-8 bg-[#111b21] p-6 rounded-[2.5rem] text-white flex justify-between items-center shadow-xl">
               <div>
                 <p className="text-[9px] font-black uppercase text-gray-400">Total Aberto</p>
                 <p className="text-xl font-black">{format(cardAnalysis.find(c => c.id === showExtrato)?.used || 0)}</p>
               </div>
               <button 
                 onClick={() => {
                   const c = cardAnalysis.find(c => c.id === showExtrato);
                   if (c) handleOpenPayment(c);
                   setShowExtrato(null);
                 }}
                 className="bg-[#00a884] text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg"
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
