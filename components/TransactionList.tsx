
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete }) => {
  const [filterCat, setFilterCat] = useState('ALL');
  const [filterMethod, setFilterMethod] = useState('ALL');
  const [filterRange, setFilterRange] = useState('ALL');

  const categories = useMemo(() => Array.from(new Set(transactions.map(t => t.category))).sort(), [transactions]);
  const methods = useMemo(() => Array.from(new Set(transactions.map(t => t.paymentMethod || 'Outros'))).sort(), [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const matchCat = filterCat === 'ALL' || t.category === filterCat;
      const matchMethod = filterMethod === 'ALL' || t.paymentMethod === filterMethod;
      
      const d = new Date(t.date);
      const now = new Date();
      let matchDate = true;
      if (filterRange === 'TODAY') matchDate = d.toDateString() === now.toDateString();
      else if (filterRange === 'WEEK') {
        const lastWeek = new Date(); lastWeek.setDate(now.getDate() - 7);
        matchDate = d >= lastWeek;
      }
      else if (filterRange === 'MONTH') matchDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

      return matchCat && matchMethod && matchDate;
    });
  }, [transactions, filterCat, filterMethod, filterRange]);

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#f8fafc] no-scrollbar pb-32">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic">Extrato</h2>
        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Registros Auditados</p>
      </div>

      {/* Seção de Filtros */}
      <div className="space-y-4 mb-8">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['ALL', 'TODAY', 'WEEK', 'MONTH'].map(r => (
            <button key={r} onClick={() => setFilterRange(r)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${filterRange === r ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>
              {r === 'ALL' ? 'Tudo' : r === 'TODAY' ? 'Hoje' : r === 'WEEK' ? '7 Dias' : 'Mês'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
           <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="bg-white border border-gray-100 p-3 rounded-xl text-[9px] font-black uppercase outline-none shadow-sm">
             <option value="ALL">Categoria</option>
             {categories.map(c => <option key={c} value={c}>{c}</option>)}
           </select>
           <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="bg-white border border-gray-100 p-3 rounded-xl text-[9px] font-black uppercase outline-none shadow-sm">
             <option value="ALL">Pagamento</option>
             {methods.map(m => <option key={m} value={m}>{m}</option>)}
           </select>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length > 0 ? filtered.map(t => (
          <div key={t.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between group animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {t.type === 'INCOME' ? '↓' : '↑'}
              </div>
              <div className="max-w-[140px]">
                <p className="font-black text-slate-900 text-sm truncate">{t.description}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[7px] font-black uppercase text-slate-300 tracking-widest">{t.category}</span>
                  <span className="text-[7px] font-black uppercase text-emerald-600/50 tracking-widest">{t.paymentMethod}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-black text-sm ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatter.format(t.amount)}</p>
              <button onClick={() => onDelete(t.id)} className="text-[8px] font-black text-rose-300 uppercase mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Excluir</button>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-gray-50">
             <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">Nenhum registro encontrado com esses filtros.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
