
import React from 'react';
import { Transaction } from '../types';

interface ListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

const TransactionList: React.FC<ListProps> = ({ transactions, onDelete }) => {
  const currency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 h-full overflow-y-auto no-scrollbar pb-24">
      <h2 className="text-2xl font-black text-gray-900 tracking-tighter italic uppercase mb-6">Extrato Detalhado</h2>
      <div className="space-y-3">
        {transactions.map(t => (
          <div key={t.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-gray-50 group">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {t.type === 'INCOME' ? '↓' : '↑'}
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">{t.description}</p>
                <p className="text-[10px] text-gray-400 uppercase font-black">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-black text-sm ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {t.type === 'INCOME' ? '+' : '-'}{currency(t.amount)}
              </p>
              <button 
                onClick={() => onDelete(t.id)}
                className="text-rose-300 text-[10px] font-black uppercase mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="text-center py-20 opacity-30 italic">Nenhum registro encontrado.</div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
