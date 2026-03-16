
import React, { useState, useMemo } from 'react';
import { Bill, PaymentMethod, Wallet } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import MoneyInput from './MoneyInput';
import { Notification, ConfirmModal } from './UI';

interface RemindersProps {
  bills: Bill[];
  wallets: Wallet[];
  uid: string;
  loading?: boolean;
}

const Reminders: React.FC<RemindersProps> = ({ bills, wallets, uid, loading }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'paid' | 'next'>('pending');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form States
  const [desc, setDesc] = useState('');
  const [val, setVal] = useState('');
  const [day, setDay] = useState('10');
  const [cat, setCat] = useState('Contas Fixas');
  const [type, setType] = useState<'PAY' | 'RECEIVE'>('PAY');

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleEdit = (bill: Bill) => {
    setEditingBill(bill);
    setDesc(bill.description);
    setVal(bill.amount.toString());
    setDay(bill.dueDay.toString());
    setCat(bill.category || (bill.type === 'RECEIVE' ? 'Recebimento' : 'Contas Fixas'));
    setType(bill.type || 'PAY');
    setShowAddForm(true);
  };

  const filteredBills = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const active = bills.filter(b => b.isActive !== false);
    
    if (activeTab === 'pending') {
      // Pendentes: Não pagas e do mês atual ou anterior
      return active.filter(b => {
        const d = new Date(b.dueDate);
        return !b.isPaid && (
          d.getFullYear() < currentYear || 
          (d.getFullYear() === currentYear && d.getMonth() <= currentMonth)
        );
      }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }
    
    if (activeTab === 'next') {
      // Próximo Ciclo: Não pagas e do mês seguinte (ou além)
      return active.filter(b => {
        const d = new Date(b.dueDate);
        return !b.isPaid && (
          d.getFullYear() > currentYear || 
          (d.getFullYear() === currentYear && d.getMonth() > currentMonth)
        );
      }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }

    // Pagas: Pagas no mês atual
    return active.filter(b => 
      b.isPaid && 
      b.paidAt && new Date(b.paidAt).getMonth() === currentMonth && new Date(b.paidAt).getFullYear() === currentYear
    ).sort((a, b) => new Date(b.paidAt || b.dueDate).getTime() - new Date(a.paidAt || a.dueDate).getTime());
  }, [bills, activeTab]);

  const handleAddBill = async () => {
    if (!desc || !val || !day) return;
    setIsLoading(true);

    if (editingBill) {
      await dispatchEvent(uid, {
        type: 'DELETE_REMINDER',
        payload: { id: editingBill.id },
        source: 'ui',
        createdAt: new Date()
      });
    }

    await dispatchEvent(uid, {
      type: 'CREATE_REMINDER',
      payload: { 
        description: desc, 
        amount: parseFloat(val), 
        dueDay: parseInt(day), 
        category: cat,
        type: type,
        recurring: true 
      },
      source: 'ui',
      createdAt: new Date()
    });
    setDesc(''); setVal(''); setType('PAY'); setShowAddForm(false); setEditingBill(null);
    setIsLoading(false);
  };

  const handlePayBill = async (method: PaymentMethod, walletId?: string) => {
    if (!payingBillId) return;
    setIsLoading(true);
    await dispatchEvent(uid, {
      type: 'PAY_REMINDER',
      payload: { 
        billId: payingBillId, 
        paymentMethod: method,
        sourceWalletId: walletId || null
      },
      source: 'ui',
      createdAt: new Date()
    });
    setPayingBillId(null);
    setIsLoading(false);
  };

  const handleDelete = (id: string) => {
    if (!id) return;
    setConfirmDelete(id);
  };

  const confirmDeleteReminder = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete;
    setConfirmDelete(null);
    
    try {
      const res = await dispatchEvent(uid, {
        type: 'DELETE_REMINDER',
        payload: { id },
        source: 'ui',
        createdAt: new Date()
      });

      if (!res.success) {
        throw new Error(res.error?.toString() || "Erro ao excluir lembrete");
      }
      setNotification({ message: "Lembrete removido com sucesso!", type: 'success' });
    } catch (err: any) {
      console.error("Erro ao excluir lembrete:", err);
      setNotification({ message: `Erro: ${err.message || "Tente novamente."}`, type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-20 bg-[var(--surface)] rounded-3xl"></div>
        <div className="h-12 bg-[var(--surface)] rounded-2xl"></div>
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-[var(--surface)] rounded-3xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade pb-32 min-h-full">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Agenda Mensal</h2>
          <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Lembretes</h1>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-[var(--green-whatsapp)] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all"
        >
          + Nova Conta
        </button>
      </header>

      {/* Tabs */}
      <div className="flex bg-[var(--surface)] p-1 rounded-2xl border border-[var(--border)]">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-[var(--bg-body)] text-[var(--green-whatsapp)] shadow-sm' : 'text-[var(--text-muted)]'}`}
        >
          Pendentes
        </button>
        <button 
          onClick={() => setActiveTab('paid')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'paid' ? 'bg-[var(--bg-body)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}
        >
          Pagas
        </button>
        <button 
          onClick={() => setActiveTab('next')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'next' ? 'bg-[var(--bg-body)] text-blue-500 shadow-sm' : 'text-[var(--text-muted)]'}`}
        >
          Próximo Ciclo
        </button>
      </div>

      <div className="space-y-3">
        {filteredBills.length > 0 ? filteredBills.map(bill => {
          const isLate = !bill.isPaid && new Date(bill.dueDate) < new Date();
          const isReceive = bill.type === 'RECEIVE';
          
          return (
            <div key={bill.id} className={`group bg-[var(--surface)] p-5 rounded-3xl border border-[var(--border)] flex justify-between items-center shadow-sm relative transition-all ${bill.isPaid ? 'opacity-70' : isLate ? 'border-l-4 border-l-red-500' : isReceive ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-[var(--green-whatsapp)]'}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`text-sm font-black ${isLate ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>{bill.description}</h4>
                  <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md ${isReceive ? 'bg-blue-500/10 text-blue-500' : 'bg-[var(--bg-body)] text-[var(--text-muted)]'}`}>
                    {isReceive ? 'A Receber' : 'A Pagar'}
                  </span>
                </div>
                <div className="flex gap-3 items-center">
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${bill.isPaid ? 'bg-[var(--bg-body)] text-[var(--text-muted)]' : isLate ? 'bg-red-500/10 text-red-500' : isReceive ? 'bg-blue-500/10 text-blue-500' : 'bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)]'}`}>
                    {bill.isPaid ? (isReceive ? 'Recebido' : 'Pago') : isLate ? 'Atrasado' : 'Pendente'}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-bold">
                    {isReceive ? 'Receber dia' : 'Vence'}: {new Date(bill.dueDate).toLocaleDateString()}
                  </span>
                  {bill.recurring && <span className="text-[14px]" title="Recorrente">🔁</span>}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <p className={`text-sm font-black ${isReceive ? 'text-blue-600' : 'text-[var(--text-primary)]'}`}>{format(bill.amount)}</p>
                <div className="flex gap-2">
                  {!bill.isPaid && (
                    <button 
                      onClick={() => setPayingBillId(bill.id)}
                      className={`px-4 py-1.5 ${isReceive ? 'bg-blue-500' : 'bg-[var(--green-whatsapp)]'} text-white rounded-lg text-[10px] font-black uppercase shadow-sm active:scale-95`}
                    >
                      {isReceive ? 'Recebi' : 'Paguei'}
                    </button>
                  )}
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(bill)} className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--text-muted)] hover:text-blue-500 transition-all">✏️</button>
                    <button onClick={() => handleDelete(bill.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-300 hover:text-red-500 transition-all">🗑️</button>
                  </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-24 bg-[var(--surface)] rounded-[3rem] border border-dashed border-[var(--border)] opacity-40">
            <p className="text-4xl mb-4">📅</p>
            <p className="text-[10px] font-black uppercase tracking-widest">Tudo limpo por aqui</p>
          </div>
        )}
      </div>

      {/* Modal Pagamento */}
      {payingBillId && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[var(--surface)] w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative animate-fade">
            <button onClick={() => setPayingBillId(null)} className="absolute top-8 right-8 text-[var(--text-muted)] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic text-center mb-8">
              {bills.find(b => b.id === payingBillId)?.type === 'RECEIVE' ? 'Onde entrou o dinheiro?' : 'De onde saiu o dinheiro?'}
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {wallets.map(w => (
                <button 
                  key={w.id}
                  onClick={() => handlePayBill('PIX', w.id)}
                  className="bg-[var(--bg-body)] hover:bg-[var(--green-whatsapp)] hover:text-white border border-[var(--border)] rounded-2xl py-4 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex flex-col items-center gap-1 shadow-sm"
                >
                  <span className="text-2xl">{w.icon || '💰'}</span>
                  <span className="truncate w-full text-center">{w.name}</span>
                </button>
              ))}
              
              {bills.find(b => b.id === payingBillId)?.type !== 'RECEIVE' && (
                <button 
                  onClick={() => handlePayBill('CARD')}
                  className="bg-[var(--bg-body)] hover:bg-rose-500 hover:text-white border border-[var(--border)] rounded-2xl py-4 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex flex-col items-center gap-1 shadow-sm"
                >
                  <span className="text-2xl">💳</span>
                  <span>Cartão</span>
                </button>
              )}

              <button 
                onClick={() => setPayingBillId(null)}
                className="col-span-2 w-full text-[10px] font-black text-[var(--text-muted)] uppercase py-4 mt-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Conta */}
      {showAddForm && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[var(--surface)] w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative animate-fade">
            <button onClick={() => { setShowAddForm(false); setEditingBill(null); setDesc(''); setVal(''); }} className="absolute top-8 right-8 text-[var(--text-muted)] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-8 text-center">{editingBill ? 'Editar Lembrete' : 'Novo Lembrete'}</h3>
            
            <div className="space-y-4">
              {!editingBill && (
                <div className="flex bg-[var(--bg-body)] p-1 rounded-2xl border border-[var(--border)] mb-4">
                  <button 
                    onClick={() => { setType('PAY'); setCat('Contas Fixas'); }}
                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${type === 'PAY' ? 'bg-[var(--surface)] text-[var(--green-whatsapp)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                  >
                    A Pagar
                  </button>
                  <button 
                    onClick={() => { setType('RECEIVE'); setCat('Recebimento'); }}
                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${type === 'RECEIVE' ? 'bg-[var(--surface)] text-blue-500 shadow-sm' : 'text-[var(--text-muted)]'}`}
                  >
                    A Receber
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Descrição</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] border border-transparent text-[var(--text-primary)]" placeholder={type === 'PAY' ? "Ex: Internet, Aluguel..." : "Ex: Salário, Freelance..."} value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Valor R$</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" 
                    placeholder="R$ 0,00" 
                    value={Number(val) || 0} 
                    onChange={v => setVal(v.toString())} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Dia Venc.</label>
                  <select className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none text-[var(--text-primary)]" value={day} onChange={e => setDay(e.target.value)}>
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Categoria</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none text-[var(--text-primary)]" value={cat} onChange={e => setCat(e.target.value)} />
              </div>
              <button 
                onClick={handleAddBill} 
                disabled={isLoading}
                className={`w-full ${type === 'RECEIVE' ? 'bg-blue-500' : 'bg-[var(--green-whatsapp)]'} text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg mt-4 active:scale-95 transition-all`}
              >
                {isLoading ? 'Salvando...' : editingBill ? 'Salvar Alterações' : 'Ativar Recorrência Mensal'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteReminder}
        title="Excluir Lembrete?"
        message="Tem certeza que deseja remover este lembrete recorrente?"
      />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default Reminders;
