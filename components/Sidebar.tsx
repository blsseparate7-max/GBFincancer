import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  expanded: boolean;
  setExpanded: (val: boolean) => void;
  role?: string;
  onClose?: () => void;
  highlightedTab?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, expanded, setExpanded, role, onClose, highlightedTab }) => {
  const isAdmin = role === 'admin';

  const groups = [
    {
      label: 'Área principal',
      items: [
        { id: 'chat', label: 'Mentor IA', icon: '💬' },
        { id: 'dash', label: 'Dashboard', icon: '📊' },
      ]
    },
    {
      label: 'Planejamento financeiro',
      items: [
        { id: 'goals', label: 'Metas', icon: '🎯' },
        { id: 'reminders', label: 'Lembretes', icon: '⏰' },
      ]
    },
    {
      label: 'Controle do dinheiro',
      items: [
        { id: 'wallets', label: 'Carteiras', icon: '👛' },
        { id: 'cc', label: 'Cartão de Crédito', icon: '💳' },
        { id: 'debts', label: 'Estou Endividado', icon: '🆘' },
      ]
    },
    {
      label: 'Indicadores financeiros',
      items: [
        { id: 'score', label: 'Score Financeiro', icon: '📈' },
        { id: 'stress', label: 'Stress Test', icon: '🧠' },
        { id: 'insights', label: 'Caminho Financeiro', icon: '🧭' },
      ]
    },
    {
      label: 'Análises',
      items: [
        { id: 'calendar', label: 'Calendário', icon: '📅' },
        { id: 'resumo', label: 'Resumo Anual', icon: '📊' },
        { id: 'extrato', label: 'Extrato', icon: '📝' },
        { id: 'categories', label: 'Categorias', icon: '🏷️' },
      ]
    },
    {
      label: 'Configurações do usuário',
      items: [
        { id: 'profile', label: 'Meu Perfil', icon: '👤' },
        { id: 'config', label: 'Ajustes IA', icon: '⚙️' },
        { id: 'support', label: 'Suporte', icon: '💬' },
      ]
    },
    ...(isAdmin ? [{
      label: 'Sistema',
      items: [
        { id: 'qa', label: 'QA / Diagnóstico', icon: '🛠️' },
        { id: 'admin_support', label: 'Suporte Admin', icon: '🎧' },
      ]
    }] : [])
  ];

  return (
    <aside className={`bg-[var(--surface)] border-r border-[var(--border)] transition-all duration-300 flex flex-col h-full text-[var(--text-primary)] shadow-2xl relative ${expanded ? 'w-72' : 'w-0 overflow-hidden'}`}>
      <div className="p-6 flex items-center justify-between h-[80px] shrink-0 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 bg-[var(--green-whatsapp)] rounded-2xl flex items-center justify-center text-white font-black italic text-sm shadow-xl shadow-[var(--green-whatsapp)]/20 border border-white/10 shrink-0">GB</div>
          {expanded && (
            <div className="flex flex-col">
              <span className="font-black italic text-[var(--text-primary)] text-lg tracking-tighter leading-none">GBFinancer</span>
              <span className="text-[8px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.3em] mt-1">Premium Edition</span>
            </div>
          )}
        </div>
        
        {/* Mobile Close Button */}
        <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-[var(--text-muted)] lg:hidden block">
          ✕
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-8 no-scrollbar">
        {isAdmin && (
          <button
            onClick={() => { setActiveTab('admin'); if(onClose) onClose(); }}
            className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all border-2 ${activeTab === 'admin' ? 'bg-[var(--green-whatsapp)] text-white border-[var(--green-whatsapp)] shadow-lg' : 'border-[var(--green-whatsapp)]/20 text-[var(--green-whatsapp)] hover:bg-[var(--green-whatsapp)]/5'}`}
          >
            <span className="text-xl min-w-[24px] text-center">👑</span>
            {expanded && <span className="text-[11px] font-black uppercase whitespace-nowrap tracking-widest">Gestão CEO</span>}
          </button>
        )}

        {groups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-2">
            {expanded && (
              <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)] mb-3 opacity-40">
                {group.label}
              </h3>
            )}
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); if(onClose) onClose(); }}
                className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all relative group ${activeTab === item.id ? 'bg-[var(--bg-body)] text-[var(--green-whatsapp)] shadow-inner border border-[var(--border)]' : 'text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-primary)]'} ${highlightedTab === item.id ? 'onboarding-highlight' : ''}`}
              >
                <span className={`text-xl min-w-[24px] text-center transition-transform ${activeTab === item.id ? 'scale-110' : 'opacity-50 group-hover:opacity-100'}`}>{item.icon}</span>
                {expanded && <span className="text-[14px] font-bold whitespace-nowrap tracking-tight">{item.label}</span>}
                {activeTab === item.id && (
                  <div className="absolute left-0 w-1 h-6 bg-[var(--green-whatsapp)] rounded-r-full" />
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>
      
      <div className="p-6 border-t border-[var(--border)] space-y-4">
        <div className="flex flex-col gap-2 items-center">
          <button 
            onClick={() => { setActiveTab('terms'); if(onClose) onClose(); }}
            className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-[var(--green-whatsapp)] transition-colors"
          >
            Termos de Uso
          </button>
          <button 
            onClick={() => { setActiveTab('privacy'); if(onClose) onClose(); }}
            className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-[var(--green-whatsapp)] transition-colors"
          >
            Privacidade
          </button>
        </div>
        <p className={`text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] italic text-center opacity-50 ${!expanded && 'hidden'}`}>Audit IA 3.1 PRO • v2.0</p>
      </div>
    </aside>
  );
};

export default Sidebar;