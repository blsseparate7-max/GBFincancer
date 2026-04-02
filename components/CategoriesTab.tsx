import React, { useState } from 'react';
import { UserCategory, Transaction } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import { Tag, Plus, Edit2, Trash2, Check, X, Palette, ShoppingCart, Coffee, Car, Home, HeartPulse, Zap, DollarSign, Briefcase, Plane, GraduationCap, Gift, Music, Smartphone, Utensils, Dumbbell, Bike, Fuel, School, BookOpen, Tv, Droplets, Wifi, Phone, Key, CreditCard, Repeat, Dog, Shirt, Sparkles, TrendingUp, Percent } from 'lucide-react';
import { Notification, ConfirmModal } from './UI';

interface CategoriesTabProps {
  uid: string;
  categories: UserCategory[];
  transactions: Transaction[];
  loading: boolean;
}

const CategoriesTab: React.FC<CategoriesTabProps> = ({ uid, categories, transactions, loading }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<UserCategory | null>(null);
  
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Tag');
  const [color, setColor] = useState('#128C7E');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserCategory | null>(null);

  const icons = [
    'Utensils', 'ShoppingCart', 'Coffee', 'Pizza', 'Bike', 'Car', 'Fuel', 'Smartphone', 
    'HeartPulse', 'Pill', 'Dumbbell', 'GraduationCap', 'School', 'BookOpen', 'Palmtree', 
    'Tv', 'Plane', 'Home', 'Droplets', 'Zap', 'Wifi', 'Phone', 'Key', 'CreditCard', 
    'Repeat', 'Dog', 'Shirt', 'Sparkles', 'TrendingUp', 'DollarSign', 'Percent', 
    'Briefcase', 'Gift', 'Tag'
  ];
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
      setNotification({ message: "Categoria salva com sucesso!", type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao salvar categoria.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (cat: UserCategory) => {
    setConfirmDelete(cat);
  };

  const confirmDeleteCategory = async () => {
    if (!confirmDelete) return;
    const cat = confirmDelete;
    setConfirmDelete(null);

    try {
      await dispatchEvent(uid, {
        type: 'DELETE_CATEGORY',
        payload: { id: cat.id, name: cat.name },
        source: 'ui',
        createdAt: new Date()
      });
      setNotification({ message: "Categoria excluída com sucesso!", type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao excluir categoria.", type: 'error' });
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Utensils': return <Utensils size={24} />;
      case 'ShoppingCart': return <ShoppingCart size={24} />;
      case 'Coffee': return <Coffee size={24} />;
      case 'Pizza': return <Utensils size={24} />; // Fallback
      case 'Bike': return <Bike size={24} />;
      case 'Car': return <Car size={24} />;
      case 'Fuel': return <Fuel size={24} />;
      case 'Smartphone': return <Smartphone size={24} />;
      case 'HeartPulse': return <HeartPulse size={24} />;
      case 'Pill': return <HeartPulse size={24} />; // Fallback
      case 'Dumbbell': return <Dumbbell size={24} />;
      case 'GraduationCap': return <GraduationCap size={24} />;
      case 'School': return <School size={24} />;
      case 'BookOpen': return <BookOpen size={24} />;
      case 'Palmtree': return <Plane size={24} />; // Fallback
      case 'Tv': return <Tv size={24} />;
      case 'Plane': return <Plane size={24} />;
      case 'Home': return <Home size={24} />;
      case 'Droplets': return <Droplets size={24} />;
      case 'Zap': return <Zap size={24} />;
      case 'Wifi': return <Wifi size={24} />;
      case 'Phone': return <Phone size={24} />;
      case 'Key': return <Key size={24} />;
      case 'CreditCard': return <CreditCard size={24} />;
      case 'Repeat': return <Repeat size={24} />;
      case 'Dog': return <Dog size={24} />;
      case 'Shirt': return <Shirt size={24} />;
      case 'Sparkles': return <Sparkles size={24} />;
      case 'TrendingUp': return <TrendingUp size={24} />;
      case 'DollarSign': return <DollarSign size={24} />;
      case 'Percent': return <Percent size={24} />;
      case 'Briefcase': return <Briefcase size={24} />;
      case 'Gift': return <Gift size={24} />;
      default: return <Tag size={24} />;
    }
  };

  const calculateSpent = (catName: string) => {
    return transactions
      .filter(t => t.category === catName && t.type === 'EXPENSE')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  };

  const calculateReceived = (catName: string) => {
    return transactions
      .filter(t => t.category === catName && t.type === 'INCOME')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--green-whatsapp)]"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-full bg-[var(--bg-body)]">
      <div className="p-6 flex justify-between items-end bg-[var(--surface)] border-b border-[var(--border)]">
        <div>
          <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Personalização</h2>
          <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Categorias</h1>
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
          {categories.map(cat => {
            const amount = cat.type === 'INCOME' ? calculateReceived(cat.name) : calculateSpent(cat.name);
            return (
              <div 
                key={cat.id}
                className="bg-[var(--surface)] border border-[var(--border)] p-5 rounded-3xl flex items-center justify-between group hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                    style={{ backgroundColor: cat.color }}
                  >
                    {getIcon(cat.icon)}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-[var(--text-primary)]">{cat.name}</h4>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest">
                        {cat.type === 'INCOME' ? 'Entrada' : 'Saída'}
                      </span>
                      <span className={`text-[11px] font-black ${cat.type === 'INCOME' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => handleOpenModal(cat)} className="p-2 hover:bg-white/10 rounded-xl text-[var(--text-muted)] hover:text-white transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(cat)} className="p-2 hover:bg-red-500/10 rounded-xl text-[var(--text-muted)] hover:text-red-500 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
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
          <div className="bg-[var(--surface)] w-full max-w-md rounded-[3rem] p-10 border border-[var(--border)] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--green-whatsapp)] opacity-50"></div>
            
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-8 right-8 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-8 text-center">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>

            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Nome da Categoria</label>
                <input 
                  className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all"
                  placeholder="Ex: Alimentação, Lazer..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Tipo</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setType('EXPENSE')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${type === 'EXPENSE' ? 'bg-red-500 text-white' : 'bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)]'}`}
                    >
                      Saída
                    </button>
                    <button 
                      onClick={() => setType('INCOME')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${type === 'INCOME' ? 'bg-emerald-500 text-white' : 'bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)]'}`}
                    >
                      Entrada
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Cor</label>
                  <div className="flex items-center gap-3 bg-[var(--bg-body)] border border-[var(--border)] rounded-xl p-2.5">
                    <div className="w-6 h-6 rounded-full shadow-inner" style={{ backgroundColor: color }} />
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">{color}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Escolha um Ícone</label>
                <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto p-2 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)]">
                  {icons.map(i => (
                    <button 
                      key={i}
                      onClick={() => setIcon(i)}
                      className={`aspect-square rounded-xl flex items-center justify-center transition-all ${icon === i ? 'bg-[var(--green-whatsapp)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                    >
                      {getIcon(i)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Escolha uma Cor</label>
                <div className="grid grid-cols-8 gap-2">
                  {colors.map(c => (
                    <button 
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-full aspect-square rounded-full transition-all flex items-center justify-center ${color === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[var(--surface)]' : 'opacity-60 hover:opacity-100'}`}
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
      
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteCategory}
        title="Excluir Categoria?"
        message={`Deseja realmente excluir a categoria "${confirmDelete?.name}"? Todas as transações vinculadas a ela serão movidas para "Outros".`}
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

export default CategoriesTab;
