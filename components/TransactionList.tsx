
import React from 'react';
import { Transaction } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete }) => {
  return (
    <div className="p-4 h-full overflow-y-auto bg-white">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Base de Dados</h2>
        <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500 font-mono">
          {transactions.length} registros
        </span>
      </div>

      <div className="space-y-3">
        {transactions.map((t) => (
          <div 
            key={t.id} 
            className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
              }`}>
                {t.type === 'INCOME' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 12-7 7-7-7"/><path d="M12 19V5"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 5v14"/></svg>
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{t.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{t.category}</span>
                  <span className="text-[10px] text-gray-300">•</span>
                  <span className="text-[10px] text-gray-400">{new Date(t.date).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <p className={`font-bold text-sm ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                {t.type === 'INCOME' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <button 
                onClick={() => onDelete(t.id)}
                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                title="Excluir registro"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg className="text-gray-300" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
            <p className="text-gray-400 text-sm">Nenhum dado cadastrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
