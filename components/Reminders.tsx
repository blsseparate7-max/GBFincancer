
import React, { useState, useMemo } from 'react';
import { Bill, PaymentMethod } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';

interface RemindersProps {
  bills: Bill[];
  uid: string;
}

const Reminders: React.FC<RemindersProps> = ({ bills, uid }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [showAddForm, setShowAddForm] = useState(false);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form States
  const [desc, setDesc] = useState('');
  const [val, setVal] = useState('');
  const [day, setDay] = useState('10');
  const [cat, setCat] = useState('Contas Fixas');

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const filteredBills = useMemo(() => {
    const active = bills.filter(b => b.isActive !== false);
    if (activeTab === 'pending') {
      return active.filter(b => !b.isPaid).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }
    return active.filter(b => b.isPaid).sort((a, b) => new Date(b.paidAt || b.dueDate).getTime() - new Date(a.paidAt || a.dueDate).getTime());
  }, [bills, activeTab]);

  const handleAddBill = async () => {
    if (!desc || !val || !day) return;
    setIsLoading(true);
    await dispatchEvent(uid, {
      type: 'CREATE_REMINDER',
      payload: { 
        description: desc, 
        amount: parseFloat(val), 
        dueDay: parseInt(day), 
        category: cat,
        recurring: true 
      },
      source: 'ui',
      createdAt: new Date()
    });
    setDesc(''); setVal(''); setShowAddForm(false);
    setIsLoading(false);
  };

  const handlePayBill = async (method: PaymentMethod) => {
    if (!payingBillId) return;
    setIsLoading(true);
    await dispatchEvent(uid, {
      type: 'PAY_REMINDER',
      payload: { billId: payingBillId, paymentMethod: method },
      source: 'ui',
      createdAt: new Date()
    });
    setPayingBillId(null);
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja remover este lembrete?")) return;
    await dispatchEvent(uid, {
      type: 'DELETE_ITEM',
      payload: { id, collection: 'reminders' },
      source: 'ui',
      createdAt: new Date()
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade pb-32">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-[10px] font-black text-[#00a884] uppercase tracking-[0.4em] mb-1">Agenda Mensal</h2>
          <h1 className="text-3xl font-black text-[#111b21] uppercase italic tracking-tighter">Lembretes</h1>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-[#00a884] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all"
        >
          + Nova Conta
        </button>
      </header>

      {/* Tabs */}
      <div className="flex bg-white/50 p-1 rounded-2xl border border-[#d1d7db]">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-white text-[#00a884] shadow-sm' : 'text-[#667781]'}`}
        >
          Pendentes
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-[#111b21] shadow-sm' : 'text-[#667781]'}`}
        >
          Histórico
        </button>
      </div>

      <div className="space-y-3">
        {filteredBills.length > 0 ? filteredBills.map(bill => {
          const isLate = !bill.isPaid && new Date(bill.dueDate) < new Date();
          return (
            <div key={bill.id} className={`group bg-white p-5 rounded-3xl border border-[#d1d7db] flex justify-between items-center shadow-sm relative transition-all ${bill.isPaid ? 'opacity-70' : isLate ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-[#00a884]'}`}>
              <div>
                <h4 className={`text-sm font-black ${isLate ? 'text-red-600' : 'text-[#111b21]'} mb-1`}>{bill.description}</h4>
                <div className="flex gap-3 items-center">
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${bill.isPaid ? 'bg-gray-100 text-gray-500' : isLate ? 'bg-red-50 text-red-500' : 'bg-[#d9fdd3] text-[#00a884]'}`}>
                    {bill.isPaid ? 'Pago' : isLate ? 'Atrasado' : 'Pendente'}
                  </span>
                  <span className="text-[10px] text-[#667781] font-bold">
                    Vence: {new Date(bill.dueDate).toLocaleDateString()}
                  </span>
                  {bill.recurring && <span className="text-[14px]" title="Recorrente">🔁</span>}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <p className="text-sm font-black text-[#111b21]">{format(bill.amount)}</p>
                <div className="flex gap-2">
                  {!bill.isPaid && (
                    <button 
                      onClick={() => setPayingBillId(bill.id)}
                      className="px-4 py-1.5 bg-[#00a884] text-white rounded-lg text-[10px] font-black uppercase shadow-sm active:scale-95"
                    >
                      Paguei
                    </button>
                  )}
                  <button onClick={() => handleDelete(bill.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-300 hover:text-red-500 transition-all">🗑️</button>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-[#d1d7db] opacity-40">
            <p className="text-4xl mb-4">📅</p>
            <p className="text-[10px] font-black uppercase tracking-widest">Tudo limpo por aqui</p>
          </div>
        )}
      </div>

      {/* Modal Pagamento */}
      {payingBillId && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative animate-fade">
            <button onClick={() => setPayingBillId(null)} className="absolute top-8 right-8 text-[#667781] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[#111b21] uppercase italic text-center mb-8">Confirmar Pagamento</h3>
            
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => handlePayBill('PIX')}
                className="w-full bg-[#00a884] text-white font-black py-4 rounded-2xl text-[11px] uppercase shadow-md flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <span>⚡</span> PIX / Saldo em Conta
              </button>
              <button 
                onClick={() => handlePayBill('CASH')}
                className="w-full bg-[#111b21] text-white font-black py-4 rounded-2xl text-[11px] uppercase shadow-md flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <span>💵</span> Dinheiro Vivo
              </button>
              <button 
                onClick={() => setPayingBillId(null)}
                className="w-full text-[10px] font-black text-gray-400 uppercase py-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Conta */}
      {showAddForm && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative animate-fade">
            <button onClick={() => setShowAddForm(false)} className="absolute top-8 right-8 text-[#667781] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[#111b21] uppercase italic mb-8 text-center">Nova Conta Recorrente</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Descrição</label>
                <input className="w-full bg-[#f0f2f5] rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#00a884] border border-transparent" placeholder="Ex: Internet, Aluguel..." value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Valor R$</label>
                  <input type="number" className="w-full bg-[#f0f2f5] rounded-2xl p-4 text-sm font-bold outline-none" placeholder="0,00" value={val} onChange={e => setVal(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Dia Venc.</label>
                  <select className="w-full bg-[#f0f2f5] rounded-2xl p-4 text-sm font-bold outline-none" value={day} onChange={e => setDay(e.target.value)}>
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2 tracking-widest">Categoria</label>
                <input className="w-full bg-[#f0f2f5] rounded-2xl p-4 text-sm font-bold outline-none" value={cat} onChange={e => setCat(e.target.value)} />
              </div>
              <button 
                onClick={handleAddBill} 
                disabled={isLoading}
                className="w-full bg-[#00a884] text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg mt-4 active:scale-95 transition-all"
              >
                {isLoading ? 'Salvando...' : 'Ativar Recorrência Mensal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reminders;
