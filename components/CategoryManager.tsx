
import React, { useState, useMemo } from 'react';
import { Category, Transaction } from '../types';

interface CategoryManagerProps {
  categories: Category[];
  transactions: Transaction[];
  onAdd: (name: string, type: 'INCOME' | 'EXPENSE') => void;
  onRemove: (name: string) => void;
  onEdit: (oldName: string, newName: string) => void;
  onClose: () => void;
  isFullPage?: boolean;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ 
  categories, 
  transactions,
  onAdd, 
  onRemove, 
  onEdit, 
  onClose, 
  isFullPage = false 
}) => {
  const [newCat, setNewCat] = useState('');
  const [activeTab, setActiveTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const mostUsed = useMemo(() => {
    const counts: { [key: string]: number } = {};
    transactions.forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
  }, [transactions]);

  const filteredCategories = useMemo(() => 
    categories.filter(c => c.type === activeTab).sort((a, b) => a.name.localeCompare(b.name)),
  [categories, activeTab]);

  const handleAdd = () => {
    if (newCat.trim()) {
      onAdd(newCat.trim(), activeTab);
      setNewCat('');
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#f8fafc] no-scrollbar pb-32">
      <div className="mb-10 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic">Organização</h2>
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] mt-1">Categorias & Segmentos</p>
        </div>
        {isFullPage && (
          <button onClick={onClose} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm text-gray-400 active:scale-90 transition-transform">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Categorias Mais Usadas */}
      <div className="mb-10">
        <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Mais Frequentes</h3>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {mostUsed.length > 0 ? mostUsed.map(cat => (
            <div key={cat} className="px-5 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-[10px] font-black text-slate-800 uppercase tracking-tight shrink-0">
               {cat}
            </div>
          )) : (
            <p className="text-[9px] text-gray-300 italic px-2">Aguardando registros para análise...</p>
          )}
        </div>
      </div>

      {/* Tabs de Tipo */}
      <div className="flex gap-3 mb-8">
        <button 
          onClick={() => setActiveTab('EXPENSE')}
          className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'EXPENSE' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-gray-400 border border-gray-100'}`}
        >
          Saídas (Despesas)
        </button>
        <button 
          onClick={() => setActiveTab('INCOME')}
          className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'INCOME' ? 'bg-emerald-600 text-white shadow-xl' : 'bg-white text-gray-400 border border-gray-100'}`}
        >
          Entradas (Ganhos)
        </button>
      </div>

      {/* Input de Adição */}
      <div className="flex gap-2 mb-10">
        <input 
          className="flex-1 bg-white border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none shadow-sm transition-all font-medium"
          placeholder={`Nova categoria de ${activeTab === 'EXPENSE' ? 'saída' : 'entrada'}...`}
          value={newCat} onChange={e => setNewCat(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button 
          onClick={handleAdd} 
          className="bg-emerald-500 text-white p-5 rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <div className="space-y-3">
        {filteredCategories.map(cat => (
          <div key={cat.name} className="flex items-center justify-between p-5 bg-white border border-gray-50 rounded-[2.5rem] group hover:shadow-md transition-all animate-in slide-in-from-bottom">
            {editing === cat.name ? (
              <input 
                autoFocus
                className="flex-1 bg-gray-50 border-2 border-emerald-500 rounded-2xl px-4 py-2 text-sm outline-none font-black text-gray-800"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={() => { onEdit(cat.name, editVal); setEditing(null); }}
                onKeyDown={e => e.key === 'Enter' && (onEdit(cat.name, editVal), setEditing(null))}
              />
            ) : (
              <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{cat.name}</span>
            )}
            
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={() => { setEditing(cat.name); setEditVal(cat.name); }} 
                className="p-3 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button 
                onClick={() => onRemove(cat.name)} 
                className="p-3 bg-rose-50 text-rose-300 hover:text-rose-600 rounded-xl transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        ))}
        
        {filteredCategories.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-gray-50">
             <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">Nenhuma categoria de {activeTab === 'EXPENSE' ? 'saída' : 'entrada'} cadastrada.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;
