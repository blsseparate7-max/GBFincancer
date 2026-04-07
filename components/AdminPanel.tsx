
import React, { useState, useMemo, useEffect } from 'react';
import { CustomerData, SubscriptionPlan, AdminConfig, AuditLog } from '../types';
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { dispatchEvent } from '../services/eventDispatcher';
import { Notification, ConfirmModal } from './UI';

const AdminPanel: React.FC<{ currentAdminId: string }> = ({ currentAdminId }) => {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'users' | 'messages' | 'config'>('dashboard');
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState<{ uid: string; updates: any } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  // States para Forms
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [targetUser, setTargetUser] = useState<string>(''); // Vazio = Global

  useEffect(() => {
    // Escuta Usuários (Privacidade CEO: apenas campos permitidos)
    const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), (snap) => {
      setCustomers(snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          userId: data.userId || d.id,
          userName: data.name || 'Usuário',
          email: data.email || 'N/A',
          status: data.status || 'active',
          role: data.role || 'user',
          createdAt: data.createdAt,
          lastLogin: data.lastLogin,
          subscriptionStatus: data.subscriptionStatus || 'PENDING',
          subscriptionExpiryDate: data.subscriptionExpiryDate,
          plan: data.plan || 'MONTHLY'
        } as CustomerData;
      }));
    });

    // Escuta Logs
    const unsubLogs = onSnapshot(query(collection(db, "admin", "auditLogs", "entries"), orderBy("createdAt", "desc"), limit(20)), (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
    });

    // Escuta Config
    const unsubConfig = onSnapshot(doc(db, "admin", "config"), (d) => {
      if (d.exists()) setConfig(d.data() as AdminConfig);
    });

    return () => { unsubUsers(); unsubLogs(); unsubConfig(); };
  }, []);

  const calculateDaysRemaining = (expiryDate?: string) => {
    if (!expiryDate) return 0;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c.status === 'active').length;
    const blocked = customers.filter(c => c.status === 'blocked').length;
    const premium = customers.filter(c => c.subscriptionStatus === 'ACTIVE').length;
    return { total, active, blocked, premium };
  }, [customers]);

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
              { id: 'users', label: 'Cadastros & Assinaturas', icon: '💳' },
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
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase text-center italic">Privacidade CEO: Dados Sensíveis Ocultos 🔒</p>
          </div>
        </aside>

        {/* Conteúdo Admin */}
        <main className="flex-1 p-8 pb-32">
          {activeSubTab === 'dashboard' && (
            <div className="space-y-8 animate-fade">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Total de Cadastros</p>
                  <h3 className="text-3xl font-black text-[var(--text-primary)]">{stats.total}</h3>
                </div>
                <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Assinaturas Ativas</p>
                  <h3 className="text-3xl font-black text-[var(--green-whatsapp)]">{stats.premium}</h3>
                </div>
                <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Usuários Bloqueados</p>
                  <h3 className="text-3xl font-black text-rose-500">{stats.blocked}</h3>
                </div>
                <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Taxa de Conversão</p>
                  <h3 className="text-3xl font-black text-amber-500">{stats.total > 0 ? ((stats.premium / stats.total) * 100).toFixed(1) : 0}%</h3>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic">Logs de Auditoria Recentes</h3>
                <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
                  {auditLogs.length === 0 ? (
                    <p className="p-8 text-center text-[var(--text-muted)] text-xs italic">Nenhuma atividade registrada.</p>
                  ) : (
                    auditLogs.map(log => (
                      <div key={log.id} className="p-4 border-b border-[var(--border)] flex justify-between items-center text-[11px]">
                        <div className="flex gap-4 items-center">
                          <span className="bg-[var(--bg-body)] px-2 py-1 rounded-lg font-black text-[var(--green-whatsapp)]">{log.action}</span>
                          <span className="text-[var(--text-muted)] font-mono">{log.details}</span>
                        </div>
                        <span className="text-[var(--text-muted)]">{log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toLocaleString() : 'Recent'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'users' && (
            <div className="space-y-4 animate-fade">
              <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[var(--bg-body)] text-[9px] font-black text-[var(--text-muted)] uppercase">
                    <tr>
                      <th className="p-4">Nome</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Assinatura</th>
                      <th className="p-4">Vigência</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {customers.map(user => {
                      const daysLeft = calculateDaysRemaining(user.subscriptionExpiryDate);
                      return (
                        <tr key={user.uid} className="border-b border-[var(--border)] hover:bg-white/5 transition-all text-[var(--text-primary)]">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[var(--green-whatsapp)]/20 flex items-center justify-center font-black text-[var(--green-whatsapp)] text-xs uppercase">
                                {(user.userName || 'U').charAt(0)}
                              </div>
                              <span className="font-bold">{user.userName}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="text-[11px] text-[var(--text-muted)]">{user.email}</p>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${user.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {user.subscriptionStatus}
                            </span>
                            <p className="text-[9px] text-[var(--text-muted)] mt-1">{user.plan}</p>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className={`font-black text-xs ${daysLeft > 5 ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
                                {daysLeft} dias
                              </span>
                              <span className="text-[9px] text-[var(--text-muted)]">restantes</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${user.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button 
                              onClick={() => handleUpdateUser(user.uid, { status: user.status === 'active' ? 'blocked' : 'active' })}
                              className={`p-2 rounded-xl transition-all ${user.status === 'active' ? 'bg-rose-500/10 text-rose-500' : 'bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)]'}`}
                              title={user.status === 'active' ? 'Bloquear' : 'Desbloquear'}
                            >
                              {user.status === 'active' ? '🚫' : '✅'}
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user.uid)}
                              className="p-2 bg-rose-500/20 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                              title="Excluir Permanentemente"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
        </main>
      </div>

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
