
import React, { useState, useMemo, useEffect } from 'react';
import { CustomerData, SubscriptionPlan } from '../types';
import { isFirebaseConfigured } from '../services/firebaseConfig';
import { syncUserData } from '../services/databaseService';
import { getCEOSummary } from '../services/geminiService';

interface AdminPanelProps {
  customers: CustomerData[];
  onUpdateUserStatus?: (userId: string, status: 'ACTIVE' | 'EXPIRED' | 'PENDING') => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ customers, onUpdateUserStatus }) => {
  const [activeSubTab, setActiveSubTab] = useState<'kpis' | 'users' | 'strategy' | 'logs'>('kpis');
  const [selectedUser, setSelectedUser] = useState<CustomerData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [ceoInsight, setCeoInsight] = useState<string>('O Gemini Pro está analisando sua base de dados...');
  
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    const fetchInsight = async () => {
      if (customers.length > 0) {
        const insight = await getCEOSummary(customers);
        setCeoInsight(insight);
      }
    };
    fetchInsight();
  }, [customers.length]);

  const metrics = useMemo(() => {
    const activeSubscribers = customers.filter(c => c.subscriptionStatus === 'ACTIVE');
    
    // MRR (Monthly Recurring Revenue) - Valores fictícios baseados no seu plano de R$ 9,90
    const mrr = activeSubscribers.reduce((acc, curr) => {
      if (curr.plan === 'MONTHLY') return acc + 9.90;
      if (curr.plan === 'YEARLY') return acc + (118.80 / 12);
      return acc;
    }, 0);
    
    // Churn Rate
    const expiredCount = customers.filter(c => c.subscriptionStatus === 'EXPIRED').length;
    const churnRate = customers.length > 0 ? (expiredCount / customers.length) * 100 : 0;
    
    // ARPU (Average Revenue Per User)
    const arpu = activeSubscribers.length > 0 ? mrr / activeSubscribers.length : 0;

    return { mrr, churnRate, arpu, total: customers.length, activeCount: activeSubscribers.length };
  }, [customers]);

  const handleStatusUpdate = async (userId: string, newStatus: 'ACTIVE' | 'EXPIRED' | 'PENDING') => {
    setIsUpdating(true);
    const success = await syncUserData(userId, { subscriptionStatus: newStatus });
    if (success && onUpdateUserStatus) {
      onUpdateUserStatus(userId, newStatus);
      if (selectedUser) setSelectedUser({ ...selectedUser, subscriptionStatus: newStatus });
    }
    setIsUpdating(false);
  };

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-sans">
      {/* Header Executivo */}
      <div className="bg-slate-900 text-white p-8 pb-12 rounded-b-[3.5rem] shadow-2xl shrink-0">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-emerald-400">CEO Control Center</h2>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Gestão de Assinaturas & Crescimento</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${firebaseReady ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {firebaseReady ? 'Cloud Online' : 'Local Storage Only'}
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'kpis', label: 'Métricas' },
            { id: 'users', label: 'Clientes' },
            { id: 'strategy', label: 'Estratégia AI' },
            { id: 'logs', label: 'Atividade' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${activeSubTab === tab.id ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-6 -mt-6 no-scrollbar pb-32">
        {activeSubTab === 'kpis' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
            {/* Grid de KPIs Principais */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Receita Mensal (MRR)</p>
                <p className="text-2xl font-black text-slate-900">{currencyFormatter.format(metrics.mrr)}</p>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Churn Rate</p>
                <p className="text-2xl font-black text-rose-600">{metrics.churnRate.toFixed(1)}%</p>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Clientes Ativos</p>
                <p className="text-2xl font-black text-slate-900">{metrics.activeCount}</p>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Médio</p>
                <p className="text-2xl font-black text-slate-900">{currencyFormatter.format(metrics.arpu)}</p>
              </div>
            </div>

            {/* Health Score da Base */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
               <h3 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest">Retenção da Base</h3>
               <div className="w-full h-4 bg-slate-50 rounded-full overflow-hidden p-1 shadow-inner">
                 <div 
                   className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                   style={{ width: `${(metrics.activeCount / (metrics.total || 1)) * 100}%` }}
                 ></div>
               </div>
               <div className="flex justify-between mt-4">
                 <p className="text-[9px] font-bold text-slate-400 uppercase">{metrics.activeCount} Ativos</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase">{metrics.total - metrics.activeCount} Expirados</p>
               </div>
            </div>
          </div>
        )}

        {activeSubTab === 'users' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2">Base de Clientes</h3>
            {customers.map(c => (
              <div 
                key={c.userId} 
                onClick={() => setSelectedUser(c)}
                className="bg-white p-5 rounded-[2rem] flex items-center justify-between border border-slate-50 hover:border-emerald-200 transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${c.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {c.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">{c.userName}</p>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{c.plan} • {c.subscriptionStatus}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900">{c.transactions?.length || 0} Lanç.</p>
                  <p className="text-[8px] font-bold text-slate-300 uppercase">Ver detalhes →</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSubTab === 'strategy' && (
          <div className="space-y-6 animate-in fade-in duration-300">
             <div className="bg-emerald-600 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                </div>
                <h3 className="text-[10px] font-black uppercase mb-4 tracking-[0.2em] text-emerald-200">Visão Geral da IA Gemini Pro</h3>
                <p className="text-sm font-bold leading-relaxed italic">"{ceoInsight}"</p>
             </div>
             
             <div className="bg-white p-6 rounded-[2.5rem] border-2 border-dashed border-slate-100">
                <h4 className="text-[9px] font-black text-slate-400 uppercase mb-4 tracking-widest">Sugestões de Marketing</h4>
                <ul className="space-y-3">
                   <li className="text-[11px] font-bold text-slate-600 flex items-center gap-3">
                     <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                     Campanha de recuperação para usuários expirados com 20% OFF.
                   </li>
                   <li className="text-[11px] font-bold text-slate-600 flex items-center gap-3">
                     <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                     Destaque a função de 'Metas' para novos usuários (Melhor Retenção).
                   </li>
                </ul>
             </div>
          </div>
        )}

        {activeSubTab === 'logs' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Atividade em Tempo Real</h3>
            <div className="space-y-2">
              {customers.sort((a,b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()).map(c => (
                <div key={c.userId + 'log'} className="bg-white p-4 rounded-2xl flex items-center justify-between border border-slate-50">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                      <p className="text-[10px] font-bold text-slate-700">
                        <span className="font-black">{c.userName}</span> sincronizou dados.
                      </p>
                   </div>
                   <p className="text-[8px] font-black text-slate-300 uppercase">{new Date(c.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Usuário */}
      {selectedUser && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative border-t-[12px] border-slate-900 animate-in slide-in-from-bottom">
            <button onClick={() => setSelectedUser(null)} className="absolute top-8 right-8 p-3 bg-slate-50 rounded-full">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            
            <div className="text-center mb-8">
               <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] mx-auto mb-4 flex items-center justify-center text-3xl font-black text-slate-300">
                 {selectedUser.userName.charAt(0).toUpperCase()}
               </div>
               <h3 className="text-2xl font-black tracking-tighter uppercase italic">{selectedUser.userName}</h3>
               <p className="text-[10px] text-emerald-600 font-black uppercase mt-1 tracking-widest">{selectedUser.plan} • {selectedUser.subscriptionStatus}</p>
            </div>

            <div className="space-y-3">
               <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Transações</p>
                    <p className="text-lg font-black text-slate-900">{selectedUser.transactions?.length || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Metas</p>
                    <p className="text-lg font-black text-slate-900">{selectedUser.goals?.length || 0}</p>
                  </div>
               </div>

               <button 
                 disabled={isUpdating}
                 onClick={() => handleStatusUpdate(selectedUser.userId, 'ACTIVE')}
                 className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-[10px] uppercase tracking-widest disabled:opacity-50"
               >
                 {isUpdating ? 'ATUALIZANDO...' : 'ATIVAR ACESSO TOTAL'}
               </button>
               
               <button 
                 disabled={isUpdating}
                 onClick={() => handleStatusUpdate(selectedUser.userId, 'EXPIRED')}
                 className="w-full bg-rose-600 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-[10px] uppercase tracking-widest disabled:opacity-50"
               >
                 SUSPENDER ACESSO
               </button>

               <button onClick={() => setSelectedUser(null)} className="w-full text-slate-400 font-black py-3 text-[9px] uppercase tracking-widest mt-4">Fechar Gerenciador</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
