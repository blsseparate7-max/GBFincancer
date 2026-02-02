
import React, { useMemo, useState } from 'react';
import { Bill } from '../types';

interface RemindersProps {
  bills: Bill[];
  onToggleBill: (id: string) => void;
  onDeleteBill: (id: string) => void;
  onPayBill: (id: string, method: string) => void;
  onAddBill: (bill: Omit<Bill, 'id' | 'isPaid'>) => void;
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
}

const Reminders: React.FC<RemindersProps> = ({ 
  bills, 
  onDeleteBill, 
  onPayBill, 
  onAddBill, 
  onUpdateBill 
}) => {
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [formData, setFormData] = useState({ description: '', amount: '', day: '' });

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  // Separação lógica: Mês Atual vs Futuro
  const sections = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const recurring = bills.filter(b => b.isRecurring);

    const currentMonthBills = recurring.filter(b => {
      const d = new Date(b.dueDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a, b) => new Date(a.dueDate).getDate() - new Date(b.dueDate).getDate());

    const futureBills = recurring.filter(b => {
      const d = new Date(b.dueDate);
      // É futuro se o ano for maior ou se o mês for maior no mesmo ano
      return d.getFullYear() > currentYear || (d.getFullYear() === currentYear && d.getMonth() > currentMonth);
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return { currentMonthBills, futureBills };
  }, [bills]);

  const handleConfirmPayment = (method: string) => {
    if (payingBillId) {
      onPayBill(payingBillId, method);
      setPayingBillId(null);
    }
  };

  const handleSaveBill = () => {
    if (formData.description && formData.amount && formData.day) {
      const today = new Date();
      const dueDate = new Date(today.getFullYear(), today.getMonth(), parseInt(formData.day)).toISOString();
      
      if (editingBill) {
        onUpdateBill(editingBill.id, {
          description: formData.description,
          amount: parseFloat(formData.amount),
          dueDate: dueDate
        });
        setEditingBill(null);
      } else {
        onAddBill({
          description: formData.description,
          amount: parseFloat(formData.amount),
          dueDate: dueDate,
          isRecurring: true,
          remindersEnabled: true,
          frequency: 'MONTHLY'
        });
      }
      setFormData({ description: '', amount: '', day: '' });
      setIsAdding(false);
    }
  };

  const startEdit = (bill: Bill) => {
    const day = new Date(bill.dueDate).getDate().toString();
    setFormData({ description: bill.description, amount: bill.amount.toString(), day: day });
    setEditingBill(bill);
    setIsAdding(true);
  };

  const BillCard: React.FC<{ bill: Bill }> = ({ bill }) => (
    <div className={`p-5 rounded-[2.5rem] border-2 flex items-center justify-between transition-all animate-in slide-in-from-right group ${bill.isPaid ? 'bg-gray-50 border-transparent opacity-50' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="flex-1 pr-4">
        <div className="flex items-center gap-2">
           <p className="text-sm font-black text-gray-800 uppercase tracking-tighter">{bill.description}</p>
           {!bill.isPaid && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
        </div>
        <p className="text-[10px] text-slate-400 font-black uppercase mt-1">
          {new Date(bill.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-black text-gray-900 mr-2">{currencyFormatter.format(bill.amount)}</p>
        
        {!bill.isPaid && (
          <button 
            onClick={() => setPayingBillId(bill.id)} 
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-emerald-500 text-white shadow-lg active:scale-90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        )}

        <button 
          onClick={() => startEdit(bill)}
          className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>

        <button 
          onClick={() => onDeleteBill(bill.id)} 
          className="w-10 h-10 rounded-2xl flex items-center justify-center bg-rose-50 text-rose-300 hover:text-rose-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden relative">
      {payingBillId && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[3rem] p-8 shadow-2xl border border-gray-100 text-center">
            <h3 className="text-xl font-black text-gray-900 mb-6 tracking-tighter italic uppercase">Confirmar Pagamento</h3>
            <div className="grid grid-cols-1 gap-2">
              {['PIX', 'Cartão', 'Dinheiro'].map(method => (
                <button 
                  key={method} onClick={() => handleConfirmPayment(method)}
                  className="w-full bg-slate-50 hover:bg-emerald-500 hover:text-white font-black py-4 rounded-2xl transition-all text-[10px] uppercase tracking-widest"
                >
                  {method}
                </button>
              ))}
              <button onClick={() => setPayingBillId(null)} className="w-full text-rose-500 font-black py-3 text-[9px] uppercase tracking-widest mt-2">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[3rem] p-8 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-6 tracking-tighter italic text-center uppercase">
              {editingBill ? 'Editar Gasto Fixo' : 'Novo Gasto Fixo'}
            </h3>
            <div className="space-y-4">
               <input 
                placeholder="Descrição (Ex: Aluguel)" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm"
                value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
               />
               <div className="grid grid-cols-2 gap-2">
                 <input 
                  placeholder="Valor R$" type="number" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm"
                  value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})}
                 />
                 <input 
                  placeholder="Dia Venc." type="number" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm"
                  value={formData.day} onChange={e => setFormData({...formData, day: e.target.value})}
                 />
               </div>
               <button 
                onClick={handleSaveBill}
                className="w-full bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-[10px] tracking-widest"
               >
                 Confirmar
               </button>
               <button onClick={() => { setIsAdding(false); setEditingBill(null); }} className="w-full text-gray-400 font-bold py-3 text-[9px] uppercase tracking-widest">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="p-8 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic">Lembretes</h2>
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Gestão de Compromissos Fixos</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="p-4 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
        {/* SEÇÃO: Mês Atual */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contas deste mês</h3>
          </div>
          {sections.currentMonthBills.length > 0 ? sections.currentMonthBills.map(bill => (
            <BillCard key={bill.id} bill={bill} />
          )) : (
            <div className="p-10 text-center border-4 border-dashed border-gray-100 rounded-[3rem]">
              <p className="text-[10px] font-black text-gray-300 uppercase italic">Nada pendente para este mês.</p>
            </div>
          )}
        </section>

        {/* SEÇÃO: Recorrências Futuras */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Próximos Meses</h3>
          </div>
          {sections.futureBills.length > 0 ? (
            <div className="space-y-3">
              {sections.futureBills.map(bill => (
                <div key={bill.id} className="p-4 rounded-3xl bg-white border border-gray-100 flex items-center justify-between opacity-60">
                  <div>
                    <p className="text-[11px] font-black text-gray-800 uppercase tracking-tight">{bill.description}</p>
                    <p className="text-[9px] font-bold text-slate-400">
                      Vencimento: {new Date(bill.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-400">{currencyFormatter.format(bill.amount)}</p>
                    <button 
                      onClick={() => onDeleteBill(bill.id)}
                      className="text-[8px] font-black text-rose-300 uppercase mt-1"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center border-2 border-dashed border-gray-50 rounded-[2.5rem]">
              <p className="text-[9px] font-black text-gray-200 uppercase italic">Sem previsões futuras.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Reminders;
