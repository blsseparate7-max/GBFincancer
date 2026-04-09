import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot, doc, startAfter, getDocs, where } from 'firebase/firestore';
import { Transaction, CreditCardInfo, UserCategory, PaymentMethod } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import { normalizeTransaction } from '../services/normalizationService';
import MoneyInput from './MoneyInput';
import ImportData from './ImportData';
import { Calendar, Tag, FileText, Trash2, Edit2, CreditCard, Wallet, ArrowUpCircle, ArrowDownCircle, Search, Filter, X, ChevronDown, Upload } from 'lucide-react';
import { Notification, ConfirmModal } from './UI';

interface ExtratoProps {
  uid: string;
  cards: CreditCardInfo[];
  categories: UserCategory[];
  wallets: any[];
  transactions?: Transaction[];
  loading?: boolean;
  initialFilters?: any;
  onClearInitialFilters?: () => void;
}

const Extrato: React.FC<ExtratoProps> = ({ 
  uid, cards, categories: userCategories, wallets, 
  transactions: propsTransactions, loading: propsLoading,
  initialFilters, onClearInitialFilters
}) => {
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Advanced Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');

  // Aplicar filtros iniciais se existirem
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.category) setSelectedCategory(initialFilters.category);
      if (initialFilters.walletId) setSelectedWalletId(initialFilters.walletId);
      if (initialFilters.startDate) setStartDate(initialFilters.startDate);
      if (initialFilters.endDate) setEndDate(initialFilters.endDate);
      if (initialFilters.type) setFilterType(initialFilters.type);
      setShowFilters(true);
      
      // Limpa os filtros iniciais do App.tsx para não re-aplicar ao voltar
      if (onClearInitialFilters) onClearInitialFilters();
    }
  }, [initialFilters, onClearInitialFilters]);

  // Modal Edit State
  const [editingTrans, setEditingTrans] = useState<Transaction | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editType, setEditType] = useState<'INCOME' | 'EXPENSE' | 'SAVING'>('EXPENSE');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('CASH');
  const [editCardId, setEditCardId] = useState('');
  const [editSourceWalletId, setEditSourceWalletId] = useState('');
  const [editTargetWalletId, setEditTargetWalletId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);

  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!uid) return;
    
    // Se temos transações via props e não há filtros de data, podemos usar como estado inicial
    // mas ainda queremos nosso próprio listener para suportar paginação e filtros avançados
    if (propsTransactions && !startDate && !endDate && localTransactions.length === 0) {
      setLocalTransactions(propsTransactions);
      setLocalLoading(false);
    }

    setLocalLoading(true);
    const userRef = doc(db, "users", uid);
    let q = query(
      collection(userRef, "transactions"),
      orderBy("date", "desc")
    );

    if (startDate) {
      q = query(q, where("date", ">=", new Date(startDate).toISOString()));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      q = query(q, where("date", "<=", end.toISOString()));
    }

    const qLimited = query(q, limit(PAGE_SIZE));

    const unsubscribe = onSnapshot(qLimited, (snap) => {
      const docs = snap.docs.map(d => normalizeTransaction(d));
      setLocalTransactions(docs);
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === PAGE_SIZE);
      setLocalLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLocalLoading(false);
    });

    return () => unsubscribe();
  }, [uid, startDate, endDate, propsTransactions]);

  const transactions = localTransactions;
  const loading = localLoading;

  const loadMore = async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    const userRef = doc(db, "users", uid);
    let q = query(
      collection(userRef, "transactions"),
      orderBy("date", "desc")
    );

    if (startDate) {
      q = query(q, where("date", ">=", new Date(startDate).toISOString()));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      q = query(q, where("date", "<=", end.toISOString()));
    }

    const qPaged = query(q, startAfter(lastDoc), limit(PAGE_SIZE));

    const snap = await getDocs(qPaged);
    if (!snap.empty) {
      const newDocs = snap.docs.map(d => normalizeTransaction(d));
      setLocalTransactions(prev => [...prev, ...newDocs]);
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  };

  const handleEdit = (t: Transaction) => {
    setEditingTrans(t);
    setEditDesc(t.description);
    setEditAmount(t.amount);
    setEditDate(t.date.split('T')[0]);
    setEditCategory(t.category);
    setEditType(t.type);
    setEditPaymentMethod(t.paymentMethod || 'CASH');
    setEditCardId(t.cardId || '');
    setEditSourceWalletId(t.sourceWalletId || '');
    setEditTargetWalletId(t.targetWalletId || '');
  };

  const handleSaveEdit = async () => {
    if (!editingTrans || isSaving) return;
    setIsSaving(true);
    
    try {
      const res = await dispatchEvent(uid, {
        type: 'UPDATE_TRANSACTION',
        payload: {
          id: editingTrans.id,
          updates: {
            description: editDesc,
            amount: editAmount,
            date: new Date(editDate).toISOString(),
            category: editCategory,
            type: editType,
            paymentMethod: editPaymentMethod,
            cardId: editPaymentMethod === 'CARD' ? editCardId : null,
            sourceWalletId: editType === 'EXPENSE' ? editSourceWalletId : null,
            targetWalletId: editType === 'INCOME' ? editTargetWalletId : null
          },
          oldData: editingTrans
        },
        source: 'ui',
        createdAt: new Date()
      });

      if (res.success) {
        setEditingTrans(null);
        setNotification({ message: "Transação atualizada com sucesso!", type: 'success' });
      } else {
        setNotification({ message: "Erro ao salvar alterações.", type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao salvar.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (t: Transaction) => {
    setConfirmDelete(t);
  };

  const confirmDeleteTransaction = async () => {
    if (!confirmDelete) return;
    const t = confirmDelete;
    setConfirmDelete(null);
    
    try {
      const res = await dispatchEvent(uid, {
        type: 'DELETE_ITEM',
        payload: {
          id: t.id,
          collection: 'transactions',
          oldData: t
        },
        source: 'ui',
        createdAt: new Date()
      });

      if (res.success) {
        setNotification({ message: "Transação excluída com sucesso!", type: 'success' });
        if (editingTrans?.id === t.id) setEditingTrans(null);
      } else {
        setNotification({ message: "Erro ao excluir transação.", type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao excluir.", type: 'error' });
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDesc = (t.description || "").toLowerCase();
      const tCat = (t.category || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      const matchesSearch = tDesc.includes(search) || tCat.includes(search);
      const matchesType = filterType === 'ALL' || t.type === filterType;
      
      // Advanced Filters
      // Date filters are now handled by Firestore query for efficiency
      const matchesCategory = !selectedCategory || t.category === selectedCategory;
      const matchesMethod = !selectedMethod || t.paymentMethod === selectedMethod;
      const matchesCard = !selectedCard || t.cardId === selectedCard;
      const matchesWallet = !selectedWalletId || t.sourceWalletId === selectedWalletId || t.targetWalletId === selectedWalletId;
      const matchesMin = !minVal || t.amount >= Number(minVal);
      const matchesMax = !maxVal || t.amount <= Number(maxVal);

      return matchesSearch && matchesType && 
             matchesCategory && matchesMethod && matchesCard && matchesWallet && matchesMin && matchesMax;
    });
  }, [transactions, searchTerm, filterType, selectedCategory, selectedMethod, selectedCard, selectedWalletId, minVal, maxVal]);

  const categoriesList = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category));
    userCategories.forEach(c => cats.add(c.name));
    return Array.from(cats).sort();
  }, [transactions, userCategories]);

  const isFiltered = useMemo(() => {
    return startDate || endDate || selectedCategory || selectedMethod || selectedCard || selectedWalletId || minVal || maxVal;
  }, [startDate, endDate, selectedCategory, selectedMethod, selectedCard, selectedWalletId, minVal, maxVal]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'CARD': return <CreditCard size={12} className="text-purple-400" />;
      case 'PIX': return <ArrowUpCircle size={12} className="text-emerald-400" />;
      case 'CASH': return <Wallet size={12} className="text-amber-400" />;
      default: return <Wallet size={12} />;
    }
  };

  const getCardName = (cardId?: string) => {
    if (!cardId) return 'Cartão';
    const card = cards.find(c => c.id === cardId);
    return card ? card.name : 'Cartão';
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
      {/* Header / Filters */}
      <div className="p-6 space-y-4 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Histórico Detalhado</h2>
            <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Extrato</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filterType === 'ALL' ? 'bg-[var(--green-whatsapp)] text-white' : 'bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-white/5'}`}
            >
              Tudo
            </button>
            <button 
              onClick={() => setFilterType('INCOME')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filterType === 'INCOME' ? 'bg-emerald-500 text-white' : 'bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-white/5'}`}
            >
              Entradas
            </button>
            <button 
              onClick={() => setFilterType('EXPENSE')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filterType === 'EXPENSE' ? 'bg-red-500 text-white' : 'bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-white/5'}`}
            >
              Saídas
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
            <input 
              type="text"
              placeholder="Buscar por descrição ou categoria..."
              className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] transition-all text-[var(--text-primary)]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowImport(true)}
            className="px-4 rounded-2xl border bg-[var(--bg-body)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2"
          >
            <Upload size={18} />
            <span className="text-[10px] font-black uppercase hidden sm:inline">Importar</span>
          </button>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 rounded-2xl border transition-all flex items-center gap-2 relative ${showFilters ? 'bg-[var(--green-whatsapp)] border-[var(--green-whatsapp)] text-white' : 'bg-[var(--bg-body)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <Filter size={18} />
            <span className="text-[10px] font-black uppercase hidden sm:inline">Filtros</span>
            {isFiltered && !showFilters && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--bg-body)]"></span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="p-6 bg-[var(--bg-body)] rounded-[2rem] border border-[var(--border)] animate-in slide-in-from-top duration-300 relative">
            <button 
              onClick={() => setShowFilters(false)}
              className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-white transition-all"
            >
              <X size={16} />
            </button>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Início</label>
                <input type="date" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)]" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Fim</label>
                <input type="date" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)]" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Categoria</label>
              <select className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)] appearance-none" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                <option value="">Todas</option>
                {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Método</label>
              <select className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)] appearance-none" value={selectedMethod} onChange={e => setSelectedMethod(e.target.value)}>
                <option value="">Todos</option>
                <option value="PIX">PIX</option>
                <option value="CASH">Dinheiro</option>
                <option value="CARD">Cartão</option>
              </select>
            </div>
            {selectedMethod === 'CARD' && (
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Cartão</label>
                <select className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)] appearance-none" value={selectedCard} onChange={e => setSelectedCard(e.target.value)}>
                  <option value="">Todos</option>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Valor Mín.</label>
              <input type="number" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)]" placeholder="0.00" value={minVal} onChange={e => setMinVal(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Valor Máx.</label>
              <input type="number" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)]" placeholder="99999" value={maxVal} onChange={e => setMaxVal(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => {
                  setStartDate(''); setEndDate(''); setSelectedCategory(''); setSelectedMethod('');
                  setSelectedCard(''); setMinVal(''); setMaxVal(''); setSearchTerm('');
                }}
                className="w-full bg-[var(--surface)] hover:bg-white/10 text-[var(--text-muted)] py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-[var(--border)]"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* List */}
      <div className="flex-1 p-6 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--green-whatsapp)]"></div>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <>
            {filteredTransactions.map((t) => (
              <div 
                key={t.id}
                onClick={() => handleEdit(t)}
                className="group bg-white/5 border border-white/10 p-5 rounded-3xl flex justify-between items-center hover:bg-white/10 transition-all cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.type === 'INCOME' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                    {t.type === 'INCOME' ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white leading-tight">{t.description}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black uppercase text-[var(--text-muted)] flex items-center gap-1">
                        <Tag size={10} /> {t.category}
                      </span>
                      <span className="text-[9px] font-black uppercase text-[var(--text-muted)] flex items-center gap-1">
                        <Calendar size={10} /> {new Date(t.date).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-[9px] font-black uppercase text-[var(--text-muted)] flex items-center gap-1">
                        {getMethodIcon(t.paymentMethod)} {t.paymentMethod === 'CARD' ? getCardName(t.cardId) : t.paymentMethod}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-white'}`}>
                    {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(t.amount)}
                  </p>
                  <div className="flex justify-end gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-all">
                    <Edit2 size={14} className="text-[var(--text-muted)] hover:text-white" />
                    <Trash2 
                      size={14} 
                      className="text-[var(--text-muted)] hover:text-red-500" 
                      onClick={(e) => { e.stopPropagation(); handleDelete(t); }} 
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {hasMore && (
              <button 
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-4 rounded-2xl border border-dashed border-[var(--border)] text-[10px] font-black uppercase text-[var(--text-muted)] hover:text-white hover:border-white/40 transition-all"
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais transações'}
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 opacity-20">
            <Search size={48} className="mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">Nenhuma transação encontrada</p>
          </div>
        )}
        <div className="h-24" /> {/* Spacer for mobile nav */}
      </div>

      {/* Edit Modal */}
      {editingTrans && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade">
          <div className="bg-[var(--surface)] w-full max-w-sm rounded-[3rem] p-10 border border-[var(--border)] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--green-whatsapp)] opacity-50"></div>
            
            <button 
              onClick={() => setEditingTrans(null)}
              className="absolute top-8 right-8 text-[var(--text-muted)] hover:text-white transition-all"
            >
              ✕
            </button>

            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-8 text-center">Editar Transação</h3>

            <div className="space-y-5">
              <div className="space-y-1.5 text-center">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Valor</label>
                <MoneyInput 
                  className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-6 text-3xl font-black text-center outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all"
                  value={editAmount}
                  onChange={setEditAmount}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Descrição</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                  <input 
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Tipo</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-4 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all appearance-none"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                  >
                    <option value="EXPENSE">Saída</option>
                    <option value="INCOME">Entrada</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Categoria</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                    <select 
                      className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-4 pl-12 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all appearance-none"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                    >
                      <option value="Outros">Outros</option>
                      {userCategories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={14} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Método</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-4 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all appearance-none"
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as any)}
                  >
                    <option value="PIX">Pix</option>
                    <option value="DEBIT">Débito</option>
                    <option value="CREDIT">Crédito</option>
                    <option value="CASH">Dinheiro</option>
                    <option value="TRANSFER">Transferência</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Data</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                    <input 
                      type="date"
                      className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-4 pl-12 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {editPaymentMethod === 'CARD' && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Cartão de Crédito</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-4 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all appearance-none"
                    value={editCardId}
                    onChange={(e) => setEditCardId(e.target.value)}
                  >
                    <option value="">Selecione um cartão...</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {editType === 'EXPENSE' && editPaymentMethod !== 'CARD' && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Carteira de Origem</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-4 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all appearance-none"
                    value={editSourceWalletId}
                    onChange={(e) => setEditSourceWalletId(e.target.value)}
                  >
                    <option value="">Selecione uma carteira...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name} (R$ {w.balance.toFixed(2)})</option>)}
                  </select>
                </div>
              )}

              {editType === 'INCOME' && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2 tracking-widest">Carteira de Destino</label>
                  <select 
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-4 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all appearance-none"
                    value={editTargetWalletId}
                    onChange={(e) => setEditTargetWalletId(e.target.value)}
                  >
                    <option value="">Selecione uma carteira...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name} (R$ {w.balance.toFixed(2)})</option>)}
                  </select>
                </div>
              )}

              <div className="pt-4 space-y-3">
                <button 
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="w-full bg-[var(--green-whatsapp)] text-white py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
                <button 
                  onClick={() => handleDelete(editingTrans)}
                  className="w-full bg-red-500/10 text-red-500 py-4 rounded-2xl font-black text-[11px] uppercase border border-red-500/20 active:scale-95 transition-all"
                >
                  Excluir Transação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteTransaction}
        title="Excluir Transação?"
        message="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
      />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {showImport && (
        <ImportData uid={uid} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
};

export default Extrato;
