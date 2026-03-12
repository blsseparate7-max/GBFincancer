import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { Wallet, WalletTransfer, WalletType, SavingGoal } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import MoneyInput from './MoneyInput';
import { MoreVertical, Edit2, Trash2, ArrowRightLeft } from 'lucide-react';

interface WalletTabProps {
  uid: string;
  freeBalance: number;
  goals: SavingGoal[];
  wallets: Wallet[];
  loading?: boolean;
}

const WalletTab: React.FC<WalletTabProps> = ({ uid, freeBalance, goals, wallets: walletsFromProps, loading }) => {
  const [wallets, setWallets] = useState<Wallet[]>(walletsFromProps);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('CONTA');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState('#00a884');
  const [note, setNote] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

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
    if (!fromId || !toId || !transferAmount || fromId === toId) return;
    const amount = Number(transferAmount);
    const sourceWallet = wallets.find(w => w.id === fromId);
    if (sourceWallet && sourceWallet.balance < amount) {
      alert("Saldo insuficiente na carteira de origem!");
      return;
    }

    setIsLoading(true);
    await dispatchEvent(uid, {
      type: 'TRANSFER_WALLET',
      payload: { fromWalletId: fromId, toWalletId: toId, amount, note: transferNote },
      source: 'ui',
      createdAt: new Date()
    });
    setFromId(''); setToId(''); setTransferAmount(''); setTransferNote(''); setIsTransferring(false);
    setIsLoading(false);
  };

  const handleDeleteWallet = async (wallet: Wallet) => {
    const hasBalance = (wallet.balance || 0) > 0;
    const msg = hasBalance 
      ? `Essa carteira ainda possui saldo (R$ ${wallet.balance.toFixed(2)}). Deseja transferir ou zerar antes de remover?`
      : "Excluir esta carteira?";
    
    if (!window.confirm(msg)) return;
    
    await dispatchEvent(uid, {
      type: 'DELETE_WALLET',
      payload: { id: wallet.id },
      source: 'ui',
      createdAt: new Date()
    });
    setActiveMenu(null);
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
    <div className="p-4 lg:p-8 space-y-8 animate-fade max-w-5xl mx-auto pb-32 min-h-full">
      {/* Header / Stats */}
      <div className="bg-[var(--surface)] rounded-[2rem] p-6 border border-[var(--border)] shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Saldo Livre (Ref)</p>
            <h3 className="text-2xl font-black text-[var(--text-primary)]">R$ {freeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total Alocado</p>
            <h3 className="text-2xl font-black text-[var(--green-whatsapp)]">R$ {totalInWallets.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Diferença</p>
            <h3 className={`text-2xl font-black ${difference === 0 ? 'text-[var(--text-muted)]' : difference > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
              R$ {difference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        {difference !== 0 && (
          <div className={`mt-4 p-3 rounded-xl text-[11px] font-bold flex items-center gap-3 ${difference > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
            <span>{difference > 0 ? '⚠️ Você ainda tem saldo não alocado em carteiras.' : '❌ O total das carteiras excede seu saldo livre disponível.'}</span>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-muted)]">Guardado em Metas:</span>
            <span className="text-xs font-black text-[var(--green-whatsapp)]">R$ {totalSavedInGoals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsAdding(true)} className="bg-[var(--green-whatsapp)] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Nova Carteira</button>
            <button onClick={() => setIsTransferring(true)} className="bg-[var(--bg-body)] text-[var(--text-primary)] border border-[var(--border)] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Transferir</button>
          </div>
        </div>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeWallets.map(wallet => (
          <div key={wallet.id} className="bg-[var(--surface)] p-5 rounded-3xl border border-[var(--border)] hover:border-[var(--green-whatsapp)]/30 transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: wallet.color || '#00a884' }} />
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{wallet.type}</p>
                <h4 className="text-lg font-black text-[var(--text-primary)]">{wallet.name}</h4>
                {wallet.note && <p className="text-[10px] text-[var(--text-muted)] italic truncate max-w-[150px]">{wallet.note}</p>}
              </div>
              <div className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === wallet.id ? null : wallet.id)}
                  className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-body)] rounded-lg transition-all"
                >
                  <MoreVertical size={16} />
                </button>

                {activeMenu === wallet.id && (
                  <div className="absolute right-0 mt-2 w-40 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <button 
                      onClick={() => openEdit(wallet)}
                      className="w-full px-4 py-3 text-left text-[10px] font-black uppercase hover:bg-[var(--bg-body)] transition-colors flex items-center gap-3"
                    >
                      <Edit2 size={14} className="text-[var(--green-whatsapp)]" /> Editar
                    </button>
                    <button 
                      onClick={() => {
                        setIsTransferring(true);
                        setFromId(wallet.id);
                        setActiveMenu(null);
                      }}
                      className="w-full px-4 py-3 text-left text-[10px] font-black uppercase hover:bg-[var(--bg-body)] transition-colors flex items-center gap-3"
                    >
                      <ArrowRightLeft size={14} className="text-amber-500" /> Transferir
                    </button>
                    <button 
                      onClick={() => handleDeleteWallet(wallet)}
                      className="w-full px-4 py-3 text-left text-[10px] font-black uppercase hover:bg-rose-500/10 text-rose-500 transition-colors flex items-center gap-3 border-t border-[var(--border)]"
                    >
                      <Trash2 size={14} /> Remover
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-[var(--text-primary)]">R$ {wallet.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-[var(--bg-body)] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[var(--green-whatsapp)]" 
                    style={{ width: `${totalInWallets > 0 ? (wallet.balance / totalInWallets) * 100 : 0}%` }} 
                  />
                </div>
                <span className="text-[10px] font-black text-[var(--text-muted)]">
                  {totalInWallets > 0 ? ((wallet.balance / totalInWallets) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Transfers */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic">Movimentações Internas</h3>
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
          {transfers.length === 0 ? (
            <p className="p-8 text-center text-[var(--text-muted)] text-xs italic">Nenhuma transferência realizada.</p>
          ) : (
            transfers.slice(0, 10).map(t => {
              const from = wallets.find(w => w.id === t.fromWalletId);
              const to = wallets.find(w => w.id === t.toWalletId);
              return (
                <div key={t.id} className="p-4 border-b border-[var(--border)] flex justify-between items-center text-[11px]">
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-primary)]">{from?.name || 'Excluída'}</span>
                      <span className="text-[var(--green-whatsapp)]">➜</span>
                      <span className="font-bold text-[var(--text-primary)]">{to?.name || 'Excluída'}</span>
                    </div>
                    {t.note && <span className="text-[var(--text-muted)] italic">({t.note})</span>}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-[var(--text-primary)]">R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{new Date(t.date).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fade">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-[2.5rem] border border-[var(--border)] p-8 space-y-6 shadow-2xl">
            <header className="text-center">
              <h3 className="text-xl font-black italic text-[var(--green-whatsapp)] uppercase tracking-tighter">Nova Carteira</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Onde está seu dinheiro?</p>
            </header>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Nome da Conta</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" placeholder="Ex: Nubank, Dinheiro Físico..." value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Tipo</label>
                  <select className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none appearance-none text-[var(--text-primary)]" value={type} onChange={e => setType(e.target.value as WalletType)}>
                    <option value="CONTA">Banco / Conta</option>
                    <option value="CARTEIRA">Dinheiro Vivo</option>
                    <option value="POUPANÇA">Poupança</option>
                    <option value="INVESTIMENTO">Investimento</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Saldo Inicial</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" 
                    placeholder="R$ 0,00" 
                    value={Number(balance) || 0} 
                    onChange={val => setBalance(val.toString())} 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Observação (Opcional)</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" placeholder="Ex: Conta principal, reserva..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Cor de Identificação</label>
                <div className="flex gap-2">
                  {['#00a884', '#128c7e', '#34b7f1', '#ffbc2c', '#ea0038', '#a62c67'].map(c => (
                    <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent opacity-50'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsAdding(false)} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase text-[var(--text-muted)] hover:bg-white/5 transition-all">Cancelar</button>
              <button onClick={handleCreateWallet} disabled={isLoading} className="flex-1 bg-[var(--green-whatsapp)] text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">
                {isLoading ? 'Salvando...' : 'Criar Carteira'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Wallet Modal */}
      {editingWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fade">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-[2.5rem] border border-[var(--border)] p-8 space-y-6 shadow-2xl">
            <header className="text-center">
              <h3 className="text-xl font-black italic text-[var(--green-whatsapp)] uppercase tracking-tighter">Editar Carteira</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Atualize os dados da sua conta</p>
            </header>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Nome da Conta</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" placeholder="Ex: Nubank, Dinheiro Físico..." value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Tipo</label>
                  <select className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none appearance-none text-[var(--text-primary)]" value={type} onChange={e => setType(e.target.value as WalletType)}>
                    <option value="CONTA">Banco / Conta</option>
                    <option value="CARTEIRA">Dinheiro Vivo</option>
                    <option value="POUPANÇA">Poupança</option>
                    <option value="INVESTIMENTO">Investimento</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Saldo Atual</label>
                  <MoneyInput 
                    className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" 
                    placeholder="R$ 0,00" 
                    value={Number(balance) || 0} 
                    onChange={val => setBalance(val.toString())} 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Observação (Opcional)</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" placeholder="Ex: Conta principal, reserva..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Cor de Identificação</label>
                <div className="flex gap-2">
                  {['#00a884', '#128c7e', '#34b7f1', '#ffbc2c', '#ea0038', '#a62c67'].map(c => (
                    <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent opacity-50'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setEditingWallet(null)} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase text-[var(--text-muted)] hover:bg-white/5 transition-all">Cancelar</button>
              <button onClick={handleUpdateWallet} disabled={isLoading} className="flex-1 bg-[var(--green-whatsapp)] text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">
                {isLoading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isTransferring && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fade">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-[2.5rem] border border-[var(--border)] p-8 space-y-6 shadow-2xl">
            <header className="text-center">
              <h3 className="text-xl font-black italic text-[var(--green-whatsapp)] uppercase tracking-tighter">Transferência Interna</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Mover saldo entre contas</p>
            </header>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Origem</label>
                  <select className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none appearance-none text-[var(--text-primary)]" value={fromId} onChange={e => setFromId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name} (R$ {w.balance})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Destino</label>
                  <select className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none appearance-none text-[var(--text-primary)]" value={toId} onChange={e => setToId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Valor</label>
                <MoneyInput 
                  className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" 
                  placeholder="R$ 0,00" 
                  value={Number(transferAmount) || 0} 
                  onChange={val => setTransferAmount(val.toString())} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Observação (Opcional)</label>
                <input className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" placeholder="Ex: Saque para gastos..." value={transferNote} onChange={e => setTransferNote(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsTransferring(false)} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase text-[var(--text-muted)] hover:bg-white/5 transition-all">Cancelar</button>
              <button onClick={handleTransfer} disabled={isLoading} className="flex-1 bg-[var(--green-whatsapp)] text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">
                {isLoading ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletTab;
