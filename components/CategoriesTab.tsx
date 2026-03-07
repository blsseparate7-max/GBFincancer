import React, { useState } from 'react';
import { UserCategory } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import { Tag, Plus, Edit2, Trash2, Check, X, Palette } from 'lucide-react';

interface CategoriesTabProps {
  uid: string;
  categories: UserCategory[];
  loading: boolean;
}

const CategoriesTab: React.FC<CategoriesTabProps> = ({ uid, categories, loading }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<UserCategory | null>(null);
  
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Tag');
  const [color, setColor] = useState('#128C7E');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [isSaving, setIsSaving] = useState(false);

  const icons = ['Tag', 'ShoppingBag', 'Coffee', 'Car', 'Home', 'Heart', 'Zap', 'DollarSign', 'Briefcase', 'Plane', 'Book', 'Gift', 'Music', 'Smartphone', 'Utensils', 'Dumbbell'];
  const colors = ['#128C7E', '#075E54', '#34B7F1', '#25D366', '#DC2626', '#EA580C', '#D97706', '#65A30D', '#059669', '#0891B2', '#2563EB', '#4F46E5', '#7C3AED', '#9333EA', '#C026D3', '#DB2777'];

  const handleOpenModal = (cat?: UserCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setName(cat.name);
      setIcon(cat.icon);
      setColor(cat.color || '#128C7E');
      setType(cat.type);
    } else {
      setEditingCategory(null);
      setName('');
      setIcon('Tag');
      setColor('#128C7E');
      setType('EXPENSE');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || isSaving) return;
    setIsSaving(true);

    try {
      if (editingCategory) {
        await dispatchEvent(uid, {
          type: 'UPDATE_CATEGORY',
          payload: { id: editingCategory.id, name, icon, color, type },
          source: 'ui',
          createdAt: new Date()
        });
      } else {
        await dispatchEvent(uid, {
          type: 'CREATE_CATEGORY',
          payload: { name, icon, color, type },
          source: 'ui',
          createdAt: new Date()
        });
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar categoria.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cat: UserCategory) => {
    if (!window.confirm(`Deseja realmente excluir a categoria "${cat.name}"? Todas as transações vinculadas a ela serão movidas para "Outros".`)) return;

    try {
      await dispatchEvent(uid, {
        type: 'DELETE_CATEGORY',
        payload: { id: cat.id, name: cat.name },
        source: 'ui',
        createdAt: new Date()
      });
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir categoria.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--green-whatsapp)]"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-body)]">
      <div className="p-6 flex justify-between items-end bg-white/5 border-b border-white/10">
        <div>
          <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Personalização</h2>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Categorias</h1>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-[var(--green-whatsapp)] text-white px-6 py-3 rounded-2xl font-black text-[11px] uppercase flex items-center gap-2 shadow-lg shadow-[var(--green-whatsapp)]/20 active:scale-95 transition-all"
        >
          <Plus size={16} /> Nova Categoria
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div 
              key={cat.id}
              className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between group hover:bg-white/10 transition-all"
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: cat.color }}
                >
                  <Tag size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">{cat.name}</h4>
                  <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                    {cat.type === 'INCOME' ? 'Entrada' : 'Saída'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => handleOpenModal(cat)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(cat)} className="p-2 hover:bg-red-500/10 rounded-xl text-gray-400 hover:text-red-500 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-20">
            <Tag size={48} className="mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">Nenhuma categoria personalizada</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade">
          <div className="bg-[#111b21] w-full max-w-md rounded-[3rem] p-10 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--green-whatsapp)] opacity-50"></div>
            
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-8 right-8 text-gray-500 hover:text-white transition-all"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-black text-white uppercase italic mb-8 text-center">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>

            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase ml-2 tracking-widest">Nome da Categoria</label>
                <input 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] text-white transition-all"
                  placeholder="Ex: Alimentação, Lazer..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-2 tracking-widest">Tipo</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setType('EXPENSE')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${type === 'EXPENSE' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-500'}`}
                    >
                      Saída
                    </button>
                    <button 
                      onClick={() => setType('INCOME')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${type === 'INCOME' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-500'}`}
                    >
                      Entrada
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-500 uppercase ml-2 tracking-widest">Cor</label>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2.5">
                    <div className="w-6 h-6 rounded-full shadow-inner" style={{ backgroundColor: color }} />
                    <span className="text-[10px] font-mono text-gray-400 uppercase">{color}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-black text-gray-500 uppercase ml-2 tracking-widest">Escolha uma Cor</label>
                <div className="grid grid-cols-8 gap-2">
                  {colors.map(c => (
                    <button 
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-full aspect-square rounded-full transition-all flex items-center justify-center ${color === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#111b21]' : 'opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check size={12} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleSave}
                  disabled={isSaving || !name.trim()}
                  className="w-full bg-[var(--green-whatsapp)] text-white py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesTab;
