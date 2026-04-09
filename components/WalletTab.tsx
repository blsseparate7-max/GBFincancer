import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { Wallet, WalletTransfer, WalletType, SavingGoal } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import MoneyInput from './MoneyInput';
import { ConfirmModal, Notification } from './UI';
import { motion } from 'framer-motion';
import { 
  MoreVertical, 
  Edit2, 
  Trash2, 
  ArrowRightLeft, 
  Wallet as WalletIcon, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Tag, 
  ArrowRight 
} from 'lucide-react';

interface WalletTabProps {
  uid: string;
  freeBalance: number;
  goals: SavingGoal[];
  wallets: Wallet[];
  transactions: any[];
  loading?: boolean;
  onNavigateToExtrato?: (filters: any) => void;
  isExpired?: boolean;
}

const WalletTab: React.FC<WalletTabProps> = ({ uid, freeBalance, goals, wallets: walletsFromProps, transactions, loading, onNavigateToExtrato, isExpired = false }) => {
  const [wallets, setWallets] = useState<Wallet[]>(walletsFromProps);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('CONTA');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState('#00a884');
  const [note, setNote] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; wallet?: any; message: string }>({ isOpen: false, message: '' });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  useEffect(() => {
    setWallets(walletsFromProps);
  }, [walletsFromProps]);

  useEffect(() => {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    
    const unsubTransfers = onSnapshot(query(collection(userRef, "walletTransfers"), orderBy("createdAt", "desc")), (snap) => {
      setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransfer)));
    });

    return () => { unsubTransfers(); };
  }, [uid]);

  const activeWallets = useMemo(() => wallets.filter(w => w.isActive !== false), [wallets]);
  const totalInWallets = useMemo(() => activeWallets.reduce((acc, w) => acc + (w.balance || 0), 0), [activeWallets]);
  const totalSavedInGoals = useMemo(() => goals.reduce((acc, g) => acc + (g.currentAmount || 0), 0), [goals]);
  const difference = freeBalance - totalInWallets;

  const handleCreateWallet = async () => {
    if (isExpired) {
      setNotification({ message: "Seu período de teste expirou. Assine para criar carteiras.", type: 'error' });
      return;
    }
    if (!name || !balance) return;
    setIsLoading(true);
    await dispatchEvent(uid, {
      type: 'CREATE_WALLET',
      payload: { name, type, balance: Number(balance), color, note },
      source: 'ui',
      createdAt: new Date()
    });
    setName(''); setBalance(''); setType('CONTA'); setNote(''); setIsAdding(false);
    setIsLoading(false);
  };

  const handleUpdateWallet = async () => {
    if (isExpired) {
      setNotification({ message: "Seu período de teste expirou. Assine para atualizar carteiras.", type: 'error' });
      return;
    }
    if (!editingWallet || !name) return;
    setIsLoading(true);
    await dispatchEvent(uid, {
      type: 'UPDATE_WALLET',
      payload: { 
        id: editingWallet.id, 
        name, 
        type, 
        balance: Number(balance), 
        color,
        note
      },
      source: 'ui',
      createdAt: new Date()
    });
    setEditingWallet(null);
    setNote('');
    setIsLoading(false);
  };

  const handleTransfer = async () => {
    if (isExpired) {
      setNotification({ message: "Seu período de teste expirou. Assine para realizar transferências.", type: 'error' });
      return;
    }
    if (!fromId || !toId || !transferAmount || fromId === toId) return;
    const amount = Number(transferAmount);
    const sourceWallet = wallets.find(w => w.id === fromId);
    if (sourceWallet && sourceWallet.balance < amount) {
      setNotification({ message: "Saldo insuficiente na carteira de origem!", type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      await dispatchEvent(uid, {
        type: 'TRANSFER_WALLET',
        payload: { fromWalletId: fromId, toWalletId: toId, amount, note: transferNote },
        source: 'ui',
        createdAt: new Date()
      });
      setNotification({ message: "Transferência realizada com sucesso!", type: 'success' });
      setFromId(''); setToId(''); setTransferAmount(''); setTransferNote(''); setIsTransferring(false);
    } catch (err) {
      setNotification({ message: "Erro ao realizar transferência.", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWallet = (wallet: Wallet) => {
    const hasBalance = (wallet.balance || 0) > 0;
    const msg = hasBalance 
      ? `Essa carteira ainda possui saldo (R$ ${wallet.balance.toFixed(2)}). Deseja realmente excluir?`
      : "Deseja excluir esta carteira?";
    
    setConfirmDelete({ isOpen: true, wallet, message: msg });
  };

  const confirmDeleteWallet = async () => {
    if (isExpired) {
      setNotification({ message: "Seu período de teste expirou. Assine para excluir carteiras.", type: 'error' });
      setConfirmDelete({ isOpen: false, message: '' });
      return;
    }
    const wallet = confirmDelete.wallet;
    if (!wallet) return;

    try {
      await dispatchEvent(uid, {
        type: 'DELETE_WALLET',
        payload: { id: wallet.id },
        source: 'ui',
        createdAt: new Date()
      });
      setNotification({ message: "Carteira excluída com sucesso!", type: 'success' });
    } catch (err) {
      setNotification({ message: "Erro ao excluir carteira.", type: 'error' });
    } finally {
      setConfirmDelete({ isOpen: false, message: '' });
      setActiveMenu(null);
    }
  };

  const openEdit = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setName(wallet.name);
    setType(wallet.type);
    setBalance(wallet.balance.toString());
    setColor(wallet.color || '#00a884');
    setNote(wallet.note || '');
    setActiveMenu(null);
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-8 space-y-8 animate-pulse max-w-5xl mx-auto">
        <div className="h-40 bg-[var(--surface)] rounded-[2rem]"></div>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-[var(--surface)] rounded-3xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-fade max-w-7xl mx-auto pb-32 min-h-full">
      {/* Notifications */}
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        title="Excluir Carteira"
        message={confirmDelete.message}
        onConfirm={confirmDeleteWallet}
        onCancel={() => setConfirmDelete({ isOpen: false, message: '' })}
        variant="danger"
        confirmText="Excluir"
      />

      {/* Header / Stats */}
      <div className="bg-[var(--surface)] rounded-[3rem] p-8 border border-[var(--border)] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--green-whatsapp)]/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">Saldo Livre (Ref)</p>
            <h3 className="text-3xl font-black text-[var(--text-primary)] italic tracking-tighter">R$ {freeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">Total Alocado</p>
            <h3 className="text-3xl font-black text-[var(--green-whatsapp)] italic tracking-tighter">R$ {totalInWallets.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">Diferença</p>
            <h3 className={`text-3xl font-black italic tracking-tighter ${difference === 0 ? 'text-[var(--text-muted)]' : difference > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
              R$ {difference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        {difference !== 0 && (
          <div className={`mt-6 p-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 ${difference > 0 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${difference > 0 ? 'bg-amber-500' : 'bg-rose-500'}`} />
            <span>{difference > 0 ? '⚠️ Você ainda tem saldo não alocado em carteiras.' : '❌ O total das carteiras excede seu saldo livre disponível.'}</span>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--green-whatsapp)]/10 flex items-center justify-center">
              <span className="text-lg">🎯</span>
            </div>
            <div>
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Guardado em Metas</p>
              <p className="text-sm font-black text-[var(--green-whatsapp)]">R$ {totalSavedInGoals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={() => setIsAdding(true)} className="flex-1 sm:flex-none bg-[var(--green-whatsapp)] text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-[var(--green-whatsapp)]/20">Nova Carteira</button>
            <button onClick={() => setIsTransferring(true)} className="flex-1 sm:flex-none bg-[var(--bg-body)] text-[var(--text-primary)] border border-[var(--border)] px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all hover:bg-white/5">Transferir</button>
          </div>
        </div>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeWallets.map(wallet => (
          <div 
            key={wallet.id} 
            onClick={() => setSelectedWallet(wallet)}
            className="bg-[var(--surface)] p-7 rounded-[2.5rem] border border-[var(--border)] hover:border-[var(--green-whatsapp)]/30 transition-all group relative overflow-hidden shadow-sm hover:shadow-xl cursor-pointer active:scale-[0.98]"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full opacity-50" style={{ backgroundColor: wallet.color || '#00a884' }} />
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">{wallet.type}</p>
                <h4 className="text-xl font-black text-[var(--text-primary)] uppercase italic tracking-tight">{wallet.name}</h4>
                {wallet.note && <p className="text-[10px] text-[var(--text-muted)] font-medium mt-1 truncate max-w-[180px]">{wallet.note}</p>}
              </div>
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === wallet.id ? null : wallet.id);
                  }}
                  className="w-10 h-10 flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-body)] rounded-xl transition-all border border-transparent hover:border-[var(--border)]"
                >
                  <MoreVertical size={18} />
                </button>

                {activeMenu === wallet.id && (
                  <div className="absolute right-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl">
                    <button 
                      onClick={() => openEdit(wallet)}
                      className="w-full px-5 py-4 text-left text-[10px] font-black uppercase hover:bg-white/5 transition-colors flex items-center gap-3"
                    >
                      <Edit2 size={14} className="text-[var(--green-whatsapp)]" /> Editar Dados
                    </button>
                    <button 
                      onClick={() => {
                        setIsTransferring(true);
                        setFromId(wallet.id);
                        setActiveMenu(null);
                      }}
                      className="w-full px-5 py-4 text-left text-[10px] font-black uppercase hover:bg-white/5 transition-colors flex items-center gap-3"
                    >
                      <ArrowRightLeft size={14} className="text-amber-500" /> Transferir Saldo
                    </button>
                    <button 
                      onClick={() => handleDeleteWallet(wallet)}
                      className="w-full px-5 py-4 text-left text-[10px] font-black uppercase hover:bg-rose-500/10 text-rose-500 transition-colors flex items-center gap-3 border-t border-[var(--border)]"
                    >
                      <Trash2 size={14} /> Remover Conta
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-3xl font-black text-[var(--text-primary)] tracking-tighter italic">R$ {wallet.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Participação</span>
                  <span className="text-[10px] font-black text-[var(--text-primary)]">
                    {totalInWallets > 0 ? ((wallet.balance / totalInWallets) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--bg-body)] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${totalInWallets > 0 ? (wallet.balance / totalInWallets) * 100 : 0}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-[var(--green-whatsapp)] shadow-[0_0_10px_rgba(0,168,132,0.3)]" 
                    style={{ backgroundColor: wallet.color || '#00a884' }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Transfers */}
      <div className="space-y-6">
        <h3 className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] italic ml-4">Movimentações Internas</h3>
        <div className="bg-[var(--surface)] rounded-[2.5rem] border border-[var(--border)] overflow-hidden shadow-sm">
          {transfers.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-[var(--bg-body)] rounded-full flex items-center justify-center mx-auto opacity-20">
                <ArrowRightLeft size={32} />
              </div>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic">Nenhuma transferência realizada.</p>
            </div>
          ) : (
            transfers.slice(0, 10).map(t => {
              const from = wallets.find(w => w.id === t.fromWalletId);
              const to = wallets.find(w => w.id === t.toWalletId);
              return (
                <div key={t.id} className="p-6 border-b border-[var(--border)] last:border-0 flex justify-between items-center group hover:bg-white/5 transition-colors">
                  <div className="flex gap-6 items-center">
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-body)] flex items-center justify-center border border-[var(--border)] group-hover:border-[var(--green-whatsapp)]/30 transition-colors">
                      <ArrowRightLeft size={16} className="text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-[var(--text-primary)] uppercase italic">{from?.name || 'Excluída'}</span>
                        <span className="text-[var(--green-whatsapp)] font-black">➜</span>
                        <span className="text-xs font-black text-[var(--text-primary)] uppercase italic">{to?.name || 'Excluída'}</span>
                      </div>
                      {t.note && <p className="text-[10px] text-[var(--text-muted)] font-medium mt-1">{t.note}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-[var(--text-primary)] tracking-tight italic">R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[300] flex items-center justify-center p-4 animate-fade">
          <div className="bg-[var(--surface)] w-full max-w-2xl rounded-[3rem] border border-[var(--border)] p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
            <button 
              onClick={() => setSelectedWallet(null)} 
              className="absolute top-6 right-6 w-10 h-10 bg-[var(--bg-body)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90 border border-[var(--border)]"
            >
              ✕
            </button>
            
            <div className="mb-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: selectedWallet.color || '#00a884' }}>
                <WalletIcon size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em]">Detalhamento da Conta</p>
                <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">{selectedWallet.name}</h3>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)]">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Saldo Atual</p>
                <p className="text-lg font-black text-white">R$ {selectedWallet.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)]">
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Entradas (Mês)</p>
                <p className="text-lg font-black text-emerald-400">
                  R$ {transactions
                    .filter(t => t.targetWalletId === selectedWallet.id && t.type === 'INCOME' && new Date(t.date).getMonth() === new Date().getMonth())
                    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
                    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)]">
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Saídas (Mês)</p>
                <p className="text-lg font-black text-rose-400">
                  R$ {transactions
                    .filter(t => t.sourceWalletId === selectedWallet.id && t.type === 'EXPENSE' && new Date(t.date).getMonth() === new Date().getMonth())
                    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
                    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 px-2">Movimentações Recentes</h4>
              {transactions
                .filter(t => (t.sourceWalletId === selectedWallet.id || t.targetWalletId === selectedWallet.id) && new Date(t.date).getMonth() === new Date().getMonth())
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(t => (
                  <div key={t.id} className="bg-[var(--bg-body)] p-4 rounded-2xl border border-[var(--border)] flex justify-between items-center group">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${t.type === 'INCOME' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                        {t.type === 'INCOME' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-tight">{t.description}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[9px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                            <Calendar size={10} /> {new Date(t.date).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-[9px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                            <Tag size={10} /> {t.category}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-white'}`}>
                        {t.type === 'INCOME' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">{t.paymentMethod || 'Dinheiro'}</p>
                    </div>
                  </div>
                ))}
              
              {transactions.filter(t => (t.sourceWalletId === selectedWallet.id || t.targetWalletId === selectedWallet.id) && new Date(t.date).getMonth() === new Date().getMonth()).length === 0 && (
                <div className="py-10 text-center opacity-20">
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma movimentação este mês</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <button 
                onClick={() => {
                  if (onNavigateToExtrato) {
                    onNavigateToExtrato({
                      walletId: selectedWallet.id,
                      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
                    });
                  }
                }}
                className="w-full bg-[var(--surface)] border border-[var(--border)] text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/5 transition-all active:scale-95"
              >
                Ver no Extrato Completo <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[300] flex items-center justify-center p-4 animate-fade">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-[3rem] border border-[var(--border)] p-10 space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[var(--green-whatsapp)] opacity-50"></div>
            
            <header className="text-center">
              <h3 className="text-2xl font-black italic text-[var(--text-primary)] uppercase tracking-tighter">Nova Carteira</h3>
              <p className="text-[10px] text-[var(--green-whatsapp)] font-black uppercase tracking-[0.3em] mt-2">Onde está seu dinheiro?</p>
            </header>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Nome da Conta</label>
                <input className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all uppercase italic" placeholder="Ex: Nubank, Dinheiro Físico..." value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Tipo</label>
                  <select className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] appearance-none transition-all uppercase italic" value={type} onChange={e => setType(e.target.value as WalletType)}>
                    <option value="CONTA">Banco / Conta</option>
                    <option value="CARTEIRA">Dinheiro Vivo</option>
                    <option value="POUPANÇA">Poupança</option>
                    <option value="INVESTIMENTO">Investimento</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Saldo Inicial</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all text-center" 
                    placeholder="R$ 0,00" 
                    value={Number(balance) || 0} 
                    onChange={val => setBalance(val.toString())} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Observação (Opcional)</label>
                <input className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all" placeholder="Ex: Conta principal, reserva..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Cor de Identificação</label>
                <div className="flex justify-between px-2">
                  {['#00a884', '#128c7e', '#34b7f1', '#ffbc2c', '#ea0038', '#a62c67'].map(c => (
                    <button key={c} onClick={() => setColor(c)} className={`w-10 h-10 rounded-full border-4 transition-all ${color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button onClick={handleCreateWallet} disabled={isLoading} className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-[var(--green-whatsapp)]/20 active:scale-95 transition-all">
                {isLoading ? 'Salvando...' : 'Confirmar e Criar'}
              </button>
              <button onClick={() => setIsAdding(false)} className="w-full py-4 rounded-[1.5rem] font-black text-[10px] uppercase text-[var(--text-muted)] hover:bg-white/5 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Wallet Modal */}
      {editingWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[300] flex items-center justify-center p-4 animate-fade">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-[3rem] border border-[var(--border)] p-10 space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[var(--green-whatsapp)] opacity-50"></div>

            <header className="text-center">
              <h3 className="text-2xl font-black italic text-[var(--text-primary)] uppercase tracking-tighter">Editar Carteira</h3>
              <p className="text-[10px] text-[var(--green-whatsapp)] font-black uppercase tracking-[0.3em] mt-2">Atualize os dados da sua conta</p>
            </header>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Nome da Conta</label>
                <input className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all uppercase italic" placeholder="Ex: Nubank, Dinheiro Físico..." value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Tipo</label>
                  <select className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] appearance-none transition-all uppercase italic" value={type} onChange={e => setType(e.target.value as WalletType)}>
                    <option value="CONTA">Banco / Conta</option>
                    <option value="CARTEIRA">Dinheiro Vivo</option>
                    <option value="POUPANÇA">Poupança</option>
                    <option value="INVESTIMENTO">Investimento</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Saldo Atual</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all text-center" 
                    placeholder="R$ 0,00" 
                    value={Number(balance) || 0} 
                    onChange={val => setBalance(val.toString())} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Observação (Opcional)</label>
                <input className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-[var(--green-whatsapp)] text-[var(--text-primary)] transition-all" placeholder="Ex: Conta principal, reserva..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Cor de Identificação</label>
                <div className="flex justify-between px-2">
                  {['#00a884', '#128c7e', '#34b7f1', '#ffbc2c', '#ea0038', '#a62c67'].map(c => (
                    <button key={c} onClick={() => setColor(c)} className={`w-10 h-10 rounded-full border-4 transition-all ${color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button onClick={handleUpdateWallet} disabled={isLoading} className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-[var(--green-whatsapp)]/20 active:scale-95 transition-all">
                {isLoading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <button onClick={() => setEditingWallet(null)} className="w-full py-4 rounded-[1.5rem] font-black text-[10px] uppercase text-[var(--text-muted)] hover:bg-white/5 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {isTransferring && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[300] flex items-center justify-center p-4 animate-fade">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-[3rem] border border-[var(--border)] p-10 space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500 opacity-50"></div>

            <header className="text-center">
              <h3 className="text-2xl font-black italic text-[var(--text-primary)] uppercase tracking-tighter">Transferência</h3>
              <p className="text-[10px] text-amber-500 font-black uppercase tracking-[0.3em] mt-2">Mover saldo entre contas</p>
            </header>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Origem</label>
                  <select className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-xs font-black outline-none border border-[var(--border)] focus:border-amber-500 text-[var(--text-primary)] appearance-none transition-all uppercase italic" value={fromId} onChange={e => setFromId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name} (R$ {w.balance})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Destino</label>
                  <select className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-xs font-black outline-none border border-[var(--border)] focus:border-amber-500 text-[var(--text-primary)] appearance-none transition-all uppercase italic" value={toId} onChange={e => setToId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Valor</label>
                <MoneyInput 
                  className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-amber-500 text-[var(--text-primary)] transition-all text-center" 
                  placeholder="R$ 0,00" 
                  value={Number(transferAmount) || 0} 
                  onChange={val => setTransferAmount(val.toString())} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Observação (Opcional)</label>
                <input className="w-full bg-[var(--bg-body)] rounded-[1.5rem] p-5 text-sm font-black outline-none border border-[var(--border)] focus:border-amber-500 text-[var(--text-primary)] transition-all" placeholder="Ex: Saque para gastos..." value={transferNote} onChange={e => setTransferNote(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button onClick={handleTransfer} disabled={isLoading} className="w-full bg-amber-500 text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 active:scale-95 transition-all">
                {isLoading ? 'Processando...' : 'Confirmar Transferência'}
              </button>
              <button onClick={() => setIsTransferring(false)} className="w-full py-4 rounded-[1.5rem] font-black text-[10px] uppercase text-[var(--text-muted)] hover:bg-white/5 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletTab;
