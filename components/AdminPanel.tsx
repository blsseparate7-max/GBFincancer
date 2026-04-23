
import React, { useState, useMemo, useEffect } from 'react';
import { CustomerData, SubscriptionPlan, AdminConfig, AuditLog, AdminLogEntry, SubscriptionStatus } from '../types';
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc, where } from 'firebase/firestore';
import { dispatchEvent } from '../services/eventDispatcher';
import { Notification, ConfirmModal } from './UI';

const AdminPanel: React.FC<{ currentAdminId: string }> = ({ currentAdminId }) => {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'users' | 'messages' | 'config' | 'logs'>('dashboard');
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLogEntry[]>([]);
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'expired' | 'trial' | 'canceled' | 'blocked'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState<{ uid: string; updates: any } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ uid: string; action: string; payload?: any; title: string; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  // States para Forms
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [targetUser, setTargetUser] = useState<string>(''); // Vazio = Global

  useEffect(() => {
    // Escuta Usuários
    const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), (snap) => {
      setCustomers(snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          userId: data.userId || d.id,
          userName: data.name || 'Usuário',
          email: data.email || 'N/A',
          purchaseEmail: data.purchaseEmail || '',
          status: data.status || 'active',
          role: data.role || 'user',
          createdAt: data.createdAt,
          lastLogin: data.lastLogin,
          subscriptionStatus: (data.subscriptionStatus || 'inactive').toLowerCase(),
          subscriptionEndsAt: data.subscriptionEndsAt,
          plan: data.plan || 'mensal',
          paymentProvider: data.paymentProvider || 'kiwify'
        } as CustomerData;
      }));
    });

    // Escuta Logs Técnicos
    const unsubAudit = onSnapshot(query(collection(db, "admin", "auditLogs", "entries"), orderBy("createdAt", "desc"), limit(50)), (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
    });

    // Escuta Logs de Assinatura
    const unsubAdminLogs = onSnapshot(query(collection(db, "adminLogs"), orderBy("createdAt", "desc"), limit(50)), (snap) => {
      setAdminLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminLogEntry)));
    });

    // Escuta Config
    const unsubConfig = onSnapshot(doc(db, "admin", "config"), (d) => {
      if (d.exists()) setConfig(d.data() as AdminConfig);
    });

    return () => { unsubUsers(); unsubAudit(); unsubAdminLogs(); unsubConfig(); };
  }, []);

  const calculateDaysRemaining = (expiryDate?: string) => {
    if (!expiryDate) return 0;
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return 0;
    const expiryMidnight = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = expiryMidnight.getTime() - todayMidnight.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredUsers = useMemo(() => {
    return customers.filter(u => {
      const matchesSearch = 
        u.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.purchaseEmail?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const daysLeft = calculateDaysRemaining(u.subscriptionEndsAt);
      const isExpired = u.subscriptionStatus === 'active' && daysLeft <= 0;
      
      switch (userFilter) {
        case 'active': return matchesSearch && u.subscriptionStatus === 'active' && daysLeft > 0;
        case 'expired': return matchesSearch && (u.subscriptionStatus === 'inactive' || isExpired);
        case 'trial': return matchesSearch && u.subscriptionStatus === 'trial';
        case 'canceled': return matchesSearch && u.subscriptionStatus === 'canceled';
        case 'blocked': return matchesSearch && u.status === 'blocked';
        default: return matchesSearch;
      }
    });
  }, [customers, userFilter, searchTerm]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c.subscriptionStatus === 'active' && calculateDaysRemaining(c.subscriptionEndsAt) > 0).length;
    const expired = customers.filter(c => {
      const days = calculateDaysRemaining(c.subscriptionEndsAt);
      return (c.subscriptionStatus === 'inactive' || (c.subscriptionStatus === 'active' && days <= 0));
    }).length;
    const blocked = customers.filter(c => c.status === 'blocked').length;
    
    // Alertas
    const alerts = {
      blockedWithActive: customers.filter(c => c.status === 'blocked' && c.subscriptionStatus === 'active').length,
      expiredNotBlocked: customers.filter(c => {
        const days = calculateDaysRemaining(c.subscriptionEndsAt);
        return days <= 0 && c.subscriptionStatus === 'active' && c.status === 'active';
      }).length
    };

    return { total, active, expired, blocked, alerts };
  }, [customers]);

  const handleAdminAction = (uid: string, action: string, title?: string, message?: string, payload?: any) => {
    setConfirmAction({ 
      uid, 
      action, 
      payload,
      title: title || 'Confirmar Ação?',
      message: message || 'Deseja realmente realizar esta ação administrativa?' 
    });
  };

  const confirmAdminAction = async () => {
    if (!confirmAction) return;
    const { uid, action, payload } = confirmAction;
    setConfirmAction(null);
    setIsLoading(true);
    try {
      await dispatchEvent(currentAdminId, {
        type: 'ADMIN_MANAGE_SUBSCRIPTION',
        payload: { 
          targetUid: uid, 
          adminId: currentAdminId, 
          action,
          ...payload
        },
        source: 'admin',
        createdAt: new Date()
      });
      setNotification({ message: "Ação realizada com sucesso!", type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao realizar ação.", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = (targetUid: string, updates: any) => {
    setConfirmUpdate({ uid: targetUid, updates });
  };

  const confirmUpdateUser = async () => {
    if (!confirmUpdate) return;
    const { uid, updates } = confirmUpdate;
    setConfirmUpdate(null);
    setIsLoading(true);
    try {
      await dispatchEvent(currentAdminId, {
        type: 'ADMIN_UPDATE_USER',
        payload: { targetUid: uid, updates, adminId: currentAdminId },
        source: 'admin',
        createdAt: new Date()
      });
      setNotification({ message: "Usuário atualizado com sucesso!", type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao atualizar usuário.", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = (targetUid: string) => {
    setConfirmDelete(targetUid);
  };

  const confirmDeleteUserAction = async () => {
    if (!confirmDelete) return;
    const targetUid = confirmDelete;
    setConfirmDelete(null);
    setIsLoading(true);
    try {
      await dispatchEvent(currentAdminId, {
        type: 'ADMIN_DELETE_USER',
        payload: { targetUid, adminId: currentAdminId },
        source: 'admin',
        createdAt: new Date()
      });
      setNotification({ message: "Usuário excluído permanentemente!", type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao excluir usuário.", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!msgTitle || !msgBody) return;
    setIsLoading(true);
    try {
      await dispatchEvent(currentAdminId, {
        type: 'ADMIN_SEND_BROADCAST',
        payload: { 
          title: msgTitle, 
          body: msgBody, 
          targetUid: targetUser || null,
          adminId: currentAdminId 
        },
        source: 'admin',
        createdAt: new Date()
      });
      setMsgTitle(''); setMsgBody(''); setTargetUser('');
      setNotification({ message: "Mensagem enviada com sucesso!", type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ message: "Erro ao enviar mensagem.", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateConfig = async (newConfig: Partial<AdminConfig>) => {
    await dispatchEvent(currentAdminId, {
      type: 'ADMIN_UPDATE_CONFIG',
      payload: { config: newConfig, adminId: currentAdminId },
      source: 'admin',
      createdAt: new Date()
    });
  };

  return (
    <div className="min-h-full flex flex-col bg-[var(--bg-body)] text-[var(--text-primary)] animate-fade">
      {/* Sidebar Admin Interna */}
      <div className="flex-1 flex">
        <aside className="w-64 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col shrink-0">
          <div className="p-6 border-b border-[var(--border)]">
            <h2 className="text-xl font-black italic text-[var(--green-whatsapp)] tracking-tighter uppercase">CEO Dashboard</h2>
            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Gestão de Ativos v5.0</p>
          </div>
          
          <nav className="flex-1 p-3 space-y-1">
            {[
              { id: 'dashboard', label: 'Visão Geral', icon: '📈' },
              { id: 'users', label: 'Gestão de Assinaturas', icon: '💳' },
              { id: 'logs', label: 'Logs de Sistema', icon: '📋' },
              { id: 'messages', label: 'Comunicados', icon: '📢' },
              { id: 'config', label: 'Configurações', icon: '⚙️' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-xs font-bold transition-all ${activeSubTab === tab.id ? 'bg-[var(--surface-hover)] text-[var(--green-whatsapp)]' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="p-4 bg-[var(--bg-body)] border-t border-[var(--border)]">
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase text-center italic">CEO Financeiro v6.0 🔒</p>
          </div>
        </aside>

        {/* Conteúdo Admin */}
        <main className="flex-1 p-8 pb-32 overflow-y-auto">
          {activeSubTab === 'dashboard' && (
            <div className="space-y-8 animate-fade">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Total de Cadastros</p>
                  <h3 className="text-3xl font-black text-[var(--text-primary)]">{stats.total}</h3>
                </div>
                <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Assinaturas Ativas</p>
                  <h3 className="text-3xl font-black text-[var(--green-whatsapp)]">{stats.active}</h3>
                </div>
                <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Assinaturas Vencidas</p>
                  <h3 className="text-3xl font-black text-rose-500">{stats.expired}</h3>
                </div>
                <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Usuários Bloqueados</p>
                  <h3 className="text-3xl font-black text-amber-500">{stats.blocked}</h3>
                </div>
              </div>

              {/* Alertas Críticos */}
              {(stats.alerts.blockedWithActive > 0 || stats.alerts.expiredNotBlocked > 0) && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic">Alertas de Inconsistência ⚠️</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stats.alerts.blockedWithActive > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-4">
                        <span className="text-2xl">🚧</span>
                        <div>
                          <p className="text-xs font-black text-amber-500 uppercase">{stats.alerts.blockedWithActive} Usuários Bloqueados com Assinatura Ativa</p>
                          <p className="text-[10px] text-[var(--text-muted)]">Verifique se o usuário deve ser desbloqueado ou se a assinatura é indevida.</p>
                        </div>
                      </div>
                    )}
                    {stats.alerts.expiredNotBlocked > 0 && (
                      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-4">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <p className="text-xs font-black text-rose-500 uppercase">{stats.alerts.expiredNotBlocked} Assinaturas Vencidas sem Bloqueio</p>
                          <p className="text-[10px] text-[var(--text-muted)]">Acesso ainda liberado para assinaturas expiradas. Considere bloquear o acesso.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic">Eventos Recentes de Assinatura</h3>
                <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
                  {adminLogs.length === 0 ? (
                    <p className="p-8 text-center text-[var(--text-muted)] text-xs italic">Nenhuma atividade de assinatura registrada.</p>
                  ) : (
                    adminLogs.slice(0, 10).map(log => (
                      <div key={log.id} className="p-4 border-b border-[var(--border)] flex justify-between items-center text-[10px]">
                        <div className="flex gap-4 items-center">
                          <span className={`px-2 py-1 rounded-lg font-black uppercase ${
                            log.action.includes('error') || log.action.includes('failed') ? 'bg-rose-500/10 text-rose-500' : 'bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)]'
                          }`}>{log.action}</span>
                          <div className="flex flex-col">
                            <span className="text-[var(--text-primary)] font-bold">{log.details}</span>
                            <span className="text-[var(--text-muted)] uppercase text-[9px]">Usuário: {log.userName || log.userId}</span>
                          </div>
                        </div>
                        <span className="text-[var(--text-muted)] font-mono">{log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toLocaleString() : 'Recente'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'users' && (
            <div className="space-y-6 animate-fade">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'active', label: 'Ativos' },
                    { id: 'expired', label: 'Vencidos' },
                    { id: 'trial', label: 'Trial' },
                    { id: 'canceled', label: 'Cancelados' },
                    { id: 'blocked', label: 'Bloqueados' },
                  ].map(f => (
                    <button 
                      key={f.id}
                      onClick={() => setUserFilter(f.id as any)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        userFilter === f.id ? 'bg-[var(--green-whatsapp)] text-white shadow-lg' : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--green-whatsapp)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Buscar nome ou email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-10 py-2.5 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] w-full md:w-64 text-[var(--text-primary)]"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
                </div>
              </header>

              <div className="bg-[var(--surface)] rounded-[2.5rem] border border-[var(--border)] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[var(--bg-body)] text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)]">
                      <tr>
                        <th className="p-5">Usuário / ID</th>
                        <th className="p-5">Emails</th>
                        <th className="p-5">Assinatura</th>
                        <th className="p-5">Vigência</th>
                        <th className="p-5">Origem</th>
                        <th className="p-5">Status</th>
                        <th className="p-5 text-center">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-20 text-center text-[var(--text-muted)] italic">Nenhum usuário encontrado.</td>
                        </tr>
                      ) : (
                        filteredUsers.map(user => {
                          const daysLeft = calculateDaysRemaining(user.subscriptionEndsAt);
                          const isExpired = user.subscriptionStatus === 'active' && daysLeft <= 0;
                          
                          return (
                            <tr key={user.uid} className="border-b border-[var(--border)] hover:bg-white/5 transition-all text-[var(--text-primary)]">
                              <td className="p-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--green-whatsapp)] to-emerald-600 flex items-center justify-center font-black text-white text-sm shadow-lg">
                                    {(user.userName || 'U').charAt(0)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-black text-xs">{user.userName}</span>
                                    <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-tighter">{user.uid}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-5">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] bg-blue-500/10 text-blue-500 px-1 rounded font-black uppercase">Conta</span>
                                    <span className="text-[11px] font-medium">{user.email}</span>
                                  </div>
                                  {user.purchaseEmail && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] bg-purple-500/10 text-purple-500 px-1 rounded font-black uppercase">Compra</span>
                                      <span className="text-[11px] font-medium text-[var(--text-muted)]">{user.purchaseEmail}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-5">
                                <div className="flex flex-col">
                                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase inline-block w-fit ${
                                    user.subscriptionStatus === 'active' && !isExpired ? 'bg-emerald-500/10 text-emerald-500' : 
                                    isExpired ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                                  }`}>
                                    {isExpired ? 'VENCIDO' : user.subscriptionStatus}
                                  </span>
                                  <span className="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase italic tracking-wider">{user.plan}</span>
                                </div>
                              </td>
                              <td className="p-5">
                                <div className="flex flex-col">
                                  <span className={`font-black text-xs ${daysLeft > 5 ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
                                    {daysLeft} dias
                                  </span>
                                  <span className="text-[9px] text-[var(--text-muted)] uppercase font-bold">
                                    Até {user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-5">
                                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-[var(--bg-body)] px-2 py-1 rounded-lg">
                                  {user.paymentProvider}
                                </span>
                              </td>
                              <td className="p-5">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${user.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                  {user.status === 'active' ? 'Liberado' : 'Bloqueado'}
                                </span>
                              </td>
                              <td className="p-5">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Menu de Ações em Cascata */}
                                  <div className="flex flex-wrap justify-end gap-1.5 max-w-[180px]">
                                    <button 
                                      onClick={() => handleAdminAction(user.uid, 'ACTIVATE', 'Ativar Sistema?', 'Deseja ativar a assinatura por +30 dias?', { newPlan: 'mensal' })}
                                      className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-black"
                                      title="Ativar +30 dias"
                                    >
                                      🚀
                                    </button>
                                    <button 
                                      onClick={() => handleAdminAction(user.uid, 'RENEW', 'Renovar?', 'Deseja adicionar mais 30 dias?', { daysToAdd: 30 })}
                                      className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-all text-[10px] font-black"
                                      title="Adicionar 30 dias"
                                    >
                                      ⏳
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const email = prompt("Digite o email da compra:", user.purchaseEmail || user.email);
                                        if (email) handleAdminAction(user.uid, 'LINK_PURCHASE', 'Vincular Compra?', `Deseja vincular o email ${email}?`, { manualEmail: email });
                                      }}
                                      className="p-1.5 bg-purple-500/10 text-purple-500 rounded-lg hover:bg-purple-500 hover:text-white transition-all text-[10px] font-black"
                                      title="Vincular Email de Compra"
                                    >
                                      📧
                                    </button>
                                    <button 
                                      onClick={() => handleAdminAction(user.uid, user.status === 'active' ? 'BLOCK' : 'UNBLOCK', 'Alterar Acesso?', 'Deseja mudar o status de bloqueio?')}
                                      className={`p-1.5 rounded-lg transition-all text-[10px] font-black ${user.status === 'active' ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500'} hover:text-white`}
                                      title={user.status === 'active' ? 'Bloquear' : 'Desbloquear'}
                                    >
                                      {user.status === 'active' ? '🚫' : '✅'}
                                    </button>
                                    <button 
                                      onClick={() => handleAdminAction(user.uid, 'CANCEL', 'Cancelar de Vez?', 'Deseja marcar a assinatura como cancelada?')}
                                      className="p-1.5 bg-[var(--text-muted)]/10 text-[var(--text-muted)] rounded-lg hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black"
                                      title="Cancelar Assinatura"
                                    >
                                      ✖️
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'messages' && (
            <div className="max-w-xl mx-auto space-y-8 animate-fade">
              <div className="bg-[var(--surface)] p-8 rounded-[3rem] border border-[var(--border)] space-y-6">
                <header className="text-center">
                  <h3 className="text-xl font-black italic tracking-tighter uppercase text-[var(--green-whatsapp)]">Broadcast Oficial</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Envio de Mensagens em Massa</p>
                </header>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Título da Mensagem</label>
                    <input className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]" placeholder="Ex: Manutenção Programada" value={msgTitle} onChange={e => setMsgTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Corpo da Mensagem</label>
                    <textarea className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-medium outline-none border border-transparent focus:border-[var(--green-whatsapp)] h-32 text-[var(--text-primary)]" placeholder="Escreva o comunicado aqui..." value={msgBody} onChange={e => setMsgBody(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-2">Destinatário (Vazio para Global)</label>
                    <select className="w-full bg-[var(--bg-body)] rounded-2xl p-4 text-sm font-bold outline-none appearance-none text-[var(--text-muted)] border border-transparent focus:border-[var(--green-whatsapp)]" value={targetUser} onChange={e => setTargetUser(e.target.value)}>
                      <option value="">TODOS OS USUÁRIOS (GLOBAL)</option>
                      {customers.map(u => <option key={u.uid} value={u.uid}>{u.userName} ({u.email})</option>)}
                    </select>
                  </div>
                  
                  <button 
                    onClick={handleSendBroadcast}
                    disabled={isLoading}
                    className="w-full bg-[var(--green-whatsapp)] text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl mt-4 active:scale-95 transition-all"
                  >
                    {isLoading ? 'Disparando...' : '🚀 Enviar Agora'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'config' && (
            <div className="max-w-xl mx-auto space-y-6 animate-fade">
              <div className="bg-[var(--surface)] p-8 rounded-[3rem] border border-[var(--border)] space-y-8">
                <header>
                  <h3 className="text-xl font-black italic tracking-tighter uppercase text-[var(--green-whatsapp)]">Parâmetros Globais</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Configurações de Engine IA</p>
                </header>

                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-[var(--bg-body)] rounded-2xl">
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">Porcentagem de Aporte</h4>
                      <p className="text-[9px] text-[var(--text-muted)] uppercase font-bold mt-0.5">Define a sugestão padrão do Dashboard</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        className="bg-[var(--surface)] w-16 p-2 rounded-xl text-center font-black text-[var(--green-whatsapp)] border border-[var(--border)]" 
                        value={config?.defaultAportePercent || 30} 
                        onChange={e => handleUpdateConfig({ defaultAportePercent: parseInt(e.target.value) })}
                      />
                      <span className="font-black text-[var(--green-whatsapp)]">%</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-[var(--bg-body)] rounded-2xl">
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">Modo Manutenção</h4>
                      <p className="text-[9px] text-[var(--text-muted)] uppercase font-bold mt-0.5">Bloqueia acesso às funções financeiras</p>
                    </div>
                    <button 
                      onClick={() => handleUpdateConfig({ maintenanceMode: !config?.maintenanceMode })}
                      className={`w-12 h-6 rounded-full relative transition-all ${config?.maintenanceMode ? 'bg-[var(--green-whatsapp)]' : 'bg-[var(--surface)]'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config?.maintenanceMode ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeSubTab === 'logs' && (
            <div className="space-y-4 animate-fade">
              <header className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic">Histórico Completo de Auditoria</h3>
              </header>
              <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                  {adminLogs.length === 0 && auditLogs.length === 0 ? (
                    <p className="p-12 text-center text-[var(--text-muted)] text-xs italic">Nenhum log encontrado.</p>
                  ) : (
                    <div className="flex flex-col">
                      {[...adminLogs, ...auditLogs].sort((a, b) => {
                        const dateA = a.createdAt?.seconds || 0;
                        const dateB = b.createdAt?.seconds || 0;
                        return dateB - dateA;
                      }).map((log: any, idx) => (
                        <div key={idx} className="p-4 border-b border-[var(--border)] flex justify-between items-start text-xs hover:bg-white/5 transition-all">
                          <div className="flex gap-4 items-start">
                            <span className={`px-2 py-1 rounded-lg font-black text-[9px] uppercase ${
                              (log.type === 'subscription_update' || log.action?.includes('USER')) ? 'bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)]' : 'bg-blue-500/10 text-blue-500'
                            }`}>{log.action || log.type}</span>
                            <div className="flex flex-col gap-0.5">
                              <p className="font-bold text-[var(--text-primary)]">{log.details}</p>
                              <p className="text-[9px] text-[var(--text-muted)] uppercase">
                                Usuário: {log.userName || log.targetUserId || log.userId} 
                                {log.adminId && ` • Por Admin: ${log.adminId}`}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono whitespace-nowrap ml-4">
                            {log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toLocaleString() : 'Recent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAdminAction}
        title={confirmAction?.title || "Confirmar?"}
        message={confirmAction?.message || "Deseja realizar esta ação?"}
      />

      <ConfirmModal
        isOpen={!!confirmUpdate}
        onClose={() => setConfirmUpdate(null)}
        onConfirm={confirmUpdateUser}
        title="Confirmar Alteração?"
        message="Deseja realmente aplicar estas alterações ao perfil do usuário?"
      />

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteUserAction}
        title="EXCLUIR USUÁRIO?"
        message="⚠️ AVISO CRÍTICO: Excluir este usuário permanentemente? Esta ação não pode ser desfeita."
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

export default AdminPanel;
