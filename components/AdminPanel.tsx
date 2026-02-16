
import React, { useState, useMemo, useEffect } from 'react';
import { CustomerData, SubscriptionPlan, AdminConfig, AuditLog } from '../types';
import { db } from '../services/firebaseConfig';
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { dispatchEvent } from '../services/eventDispatcher';

const AdminPanel: React.FC<{ currentAdminId: string }> = ({ currentAdminId }) => {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'users' | 'messages' | 'config'>('dashboard');
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // States para Forms
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [targetUser, setTargetUser] = useState<string>(''); // Vazio = Global

  useEffect(() => {
    // Escuta Usuários (Privacidade: apenas campos permitidos)
    const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), (snap) => {
      setCustomers(snap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          userId: data.userId || d.id,
          userName: data.name || 'Usuário',
          email: data.email || 'N/A',
          status: data.status || 'active',
          role: data.role || 'USER',
          createdAt: data.createdAt,
          lastLogin: data.lastLogin
        } as any;
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

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c.status === 'active').length;
    const blocked = total - active;
    const admins = customers.filter(c => c.role === 'ADMIN').length;
    return { total, active, blocked, admins };
  }, [customers]);

  const handleUpdateUser = async (targetUid: string, updates: any) => {
    if (!window.confirm("Confirmar alteração de status/permissão?")) return;
    setIsLoading(true);
    await dispatchEvent(currentAdminId, {
      type: 'ADMIN_UPDATE_USER',
      payload: { targetUid, updates, adminId: currentAdminId },
      source: 'admin',
      createdAt: new Date()
    });
    setIsLoading(false);
  };

  const handleSendBroadcast = async () => {
    if (!msgTitle || !msgBody) return;
    setIsLoading(true);
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
    setIsLoading(false);
    alert("Mensagem enviada com sucesso!");
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
    <div className="h-full flex flex-col bg-[#0b141a] text-[#e9edef] overflow-hidden animate-fade">
      {/* Sidebar Admin Interna */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-[#111b21] border-r border-white/5 flex flex-col shrink-0">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-black italic text-[#00a884] tracking-tighter uppercase">Painel de Controle</h2>
            <p className="text-[10px] text-[#8696a0] font-bold uppercase tracking-widest mt-1">Audit Mode v4.0</p>
          </div>
          
          <nav className="flex-1 p-3 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'users', label: 'Membros', icon: '👥' },
              { id: 'messages', label: 'Comunicados', icon: '📢' },
              { id: 'config', label: 'Sistema', icon: '⚙️' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-xs font-bold transition-all ${activeSubTab === tab.id ? 'bg-[#2a3942] text-[#00a884]' : 'text-[#8696a0] hover:bg-white/5'}`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="p-4 bg-[#202c33] border-t border-white/5">
            <p className="text-[9px] font-black text-[#8696a0] uppercase text-center italic">Privacidade Total Ativada 🔒</p>
          </div>
        </aside>

        {/* Conteúdo Admin */}
        <main className="flex-1 overflow-y-auto p-8 no-scrollbar pb-32">
          {activeSubTab === 'dashboard' && (
            <div className="space-y-8 animate-fade">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#111b21] p-6 rounded-3xl border border-white/5">
                  <p className="text-[9px] font-black text-[#8696a0] uppercase mb-1">Membros Totais</p>
                  <h3 className="text-3xl font-black">{stats.total}</h3>
                </div>
                <div className="bg-[#111b21] p-6 rounded-3xl border border-white/5">
                  <p className="text-[9px] font-black text-[#8696a0] uppercase mb-1">Status Ativo</p>
                  <h3 className="text-3xl font-black text-[#00a884]">{stats.active}</h3>
                </div>
                <div className="bg-[#111b21] p-6 rounded-3xl border border-white/5">
                  <p className="text-[9px] font-black text-[#8696a0] uppercase mb-1">Contas Bloqueadas</p>
                  <h3 className="text-3xl font-black text-rose-500">{stats.blocked}</h3>
                </div>
                <div className="bg-[#111b21] p-6 rounded-3xl border border-white/5">
                  <p className="text-[9px] font-black text-[#8696a0] uppercase mb-1">Administradores</p>
                  <h3 className="text-3xl font-black text-amber-500">{stats.admins}</h3>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest italic">Últimas Ações de Auditoria</h3>
                <div className="bg-[#111b21] rounded-3xl border border-white/5 overflow-hidden">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-4 border-b border-white/5 flex justify-between items-center text-[11px]">
                      <div className="flex gap-4 items-center">
                        <span className="bg-[#2a3942] px-2 py-1 rounded-lg font-black text-[#00a884]">{log.action}</span>
                        <span className="text-[#8696a0] font-mono">{log.details}</span>
                      </div>
                      <span className="text-[#667781]">{new Date(log.createdAt?.seconds * 1000).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'users' && (
            <div className="space-y-4 animate-fade">
              <div className="bg-[#111b21] rounded-3xl border border-white/5 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#202c33] text-[9px] font-black text-[#8696a0] uppercase">
                    <tr>
                      <th className="p-4">Membro</th>
                      <th className="p-4">ID / Email</th>
                      <th className="p-4">Criado em</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {customers.map(user => (
                      <tr key={user.uid} className="border-b border-white/5 hover:bg-white/5 transition-all">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#00a884]/20 flex items-center justify-center font-black text-[#00a884] text-xs uppercase">
                              {user.userName?.charAt(0)}
                            </div>
                            <span className="font-bold">{user.userName}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-[10px] font-mono text-[#8696a0]">{user.userId}</p>
                          <p className="text-[10px] text-[#667781]">{user.email}</p>
                        </td>
                        <td className="p-4 text-[10px] text-[#8696a0]">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${user.status === 'active' ? 'bg-[#d9fdd3]/10 text-[#00a884]' : 'bg-rose-500/10 text-rose-500'}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button 
                            onClick={() => handleUpdateUser(user.uid, { status: user.status === 'active' ? 'blocked' : 'active' })}
                            className={`p-2 rounded-xl transition-all ${user.status === 'active' ? 'bg-rose-500/10 text-rose-500' : 'bg-[#00a884]/10 text-[#00a884]'}`}
                            title={user.status === 'active' ? 'Bloquear' : 'Desbloquear'}
                          >
                            {user.status === 'active' ? '🚫' : '✅'}
                          </button>
                          <button 
                            onClick={() => handleUpdateUser(user.uid, { role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
                            className="p-2 bg-amber-500/10 text-amber-500 rounded-xl"
                            title="Alternar Role"
                          >
                            👑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'messages' && (
            <div className="max-w-xl mx-auto space-y-8 animate-fade">
              <div className="bg-[#111b21] p-8 rounded-[3rem] border border-white/5 space-y-6">
                <header className="text-center">
                  <h3 className="text-xl font-black italic tracking-tighter uppercase text-[#00a884]">Broadcast Oficial</h3>
                  <p className="text-[10px] text-[#8696a0] font-bold uppercase tracking-widest mt-1">Envio de Mensagens em Massa</p>
                </header>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696a0] uppercase ml-2">Título da Mensagem</label>
                    <input className="w-full bg-[#202c33] rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-[#00a884]" placeholder="Ex: Manutenção Programada" value={msgTitle} onChange={e => setMsgTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696a0] uppercase ml-2">Corpo da Mensagem</label>
                    <textarea className="w-full bg-[#202c33] rounded-2xl p-4 text-sm font-medium outline-none border border-transparent focus:border-[#00a884] h-32 no-scrollbar" placeholder="Escreva o comunicado aqui..." value={msgBody} onChange={e => setMsgBody(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696a0] uppercase ml-2">Destinatário (Vazio para Global)</label>
                    <select className="w-full bg-[#202c33] rounded-2xl p-4 text-sm font-bold outline-none appearance-none text-[#8696a0]" value={targetUser} onChange={e => setTargetUser(e.target.value)}>
                      <option value="">TODOS OS USUÁRIOS (GLOBAL)</option>
                      {customers.map(u => <option key={u.uid} value={u.uid}>{u.userName} ({u.userId})</option>)}
                    </select>
                  </div>
                  
                  <button 
                    onClick={handleSendBroadcast}
                    disabled={isLoading}
                    className="w-full bg-[#00a884] text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl mt-4 active:scale-95 transition-all"
                  >
                    {isLoading ? 'Disparando...' : '🚀 Enviar Agora'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'config' && (
            <div className="max-w-xl mx-auto space-y-6 animate-fade">
              <div className="bg-[#111b21] p-8 rounded-[3rem] border border-white/5 space-y-8">
                <header>
                  <h3 className="text-xl font-black italic tracking-tighter uppercase text-[#00a884]">Parâmetros Globais</h3>
                  <p className="text-[10px] text-[#8696a0] font-bold uppercase tracking-widest mt-1">Configurações de Engine IA</p>
                </header>

                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-[#202c33] rounded-2xl">
                    <div>
                      <h4 className="text-xs font-bold text-white">Porcentagem de Aporte</h4>
                      <p className="text-[9px] text-[#8696a0] uppercase font-bold mt-0.5">Define a sugestão padrão do Dashboard</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        className="bg-[#111b21] w-16 p-2 rounded-xl text-center font-black text-[#00a884]" 
                        value={config?.defaultAportePercent || 30} 
                        onChange={e => handleUpdateConfig({ defaultAportePercent: parseInt(e.target.value) })}
                      />
                      <span className="font-black text-[#00a884]">%</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-[#202c33] rounded-2xl">
                    <div>
                      <h4 className="text-xs font-bold text-white">Modo Manutenção</h4>
                      <p className="text-[9px] text-[#8696a0] uppercase font-bold mt-0.5">Bloqueia acesso às funções financeiras</p>
                    </div>
                    <button 
                      onClick={() => handleUpdateConfig({ maintenanceMode: !config?.maintenanceMode })}
                      className={`w-12 h-6 rounded-full relative transition-all ${config?.maintenanceMode ? 'bg-[#00a884]' : 'bg-[#111b21]'}`}
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
    </div>
  );
};

export default AdminPanel;
