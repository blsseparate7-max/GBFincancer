
import React from 'react';
import { Transaction } from '../types';

interface ListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

const TransactionList: React.FC<ListProps> = ({ transactions, onDelete }) => {
  const currency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 min-h-full pb-24">
      <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tighter italic uppercase mb-6">Extrato Detalhado</h2>
      <div className="space-y-3">
        {transactions.map(t => (
          <div key={t.id} className="bg-[var(--surface)] p-4 rounded-2xl flex items-center justify-between shadow-sm border border-[var(--border)] group">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${t.type === 'INCOME' ? 'bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)]' : 'bg-rose-500/10 text-rose-500'}`}>
                {t.type === 'INCOME' ? '↓' : '↑'}
              </div>
              <div>
                <p className="font-bold text-sm text-[var(--text-primary)]">{t.description}</p>
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-black">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-black text-sm ${t.type === 'INCOME' ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
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
          <div className="text-center py-20 opacity-30 italic text-[var(--text-muted)]">Nenhum registro encontrado.</div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
