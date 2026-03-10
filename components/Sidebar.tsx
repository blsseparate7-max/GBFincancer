import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  expanded: boolean;
  setExpanded: (val: boolean) => void;
  role?: string;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, expanded, setExpanded, role, onClose }) => {
  const isAdmin = role === 'ADMIN';

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
        { id: 'resumo', label: 'Resumo Anual', icon: '📅' },
        { id: 'extrato', label: 'Extrato', icon: '📝' },
        { id: 'categories', label: 'Categorias', icon: '🏷️' },
      ]
    },
    {
      label: 'Configurações do usuário',
      items: [
        { id: 'profile', label: 'Meu Perfil', icon: '👤' },
        { id: 'config', label: 'Ajustes IA', icon: '⚙️' },
      ]
    }
  ];

  return (
    <aside className={`bg-[var(--surface)] border-r border-[var(--border)] transition-all duration-300 flex flex-col h-full text-[var(--text-primary)] shadow-2xl relative ${expanded ? 'w-72' : 'w-0 overflow-hidden'}`}>
      <div className="p-4 flex items-center justify-between h-[64px] shrink-0 border-b border-[var(--border)] bg-[var(--bg-body)]">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 bg-[var(--green-whatsapp)] rounded-lg flex items-center justify-center text-white font-black italic text-xs shadow-lg shadow-[var(--green-whatsapp)]/20 border border-white/10 shrink-0">GB</div>
          {expanded && (
            <span className="font-black italic text-[var(--green-whatsapp)] text-xl tracking-tighter animate-fade whitespace-nowrap">GBFinancer</span>
          )}
        </div>
        
        {/* Mobile Close Button */}
        <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-[var(--text-muted)] lg:hidden block">
          ✕
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {isAdmin && (
          <button
            onClick={() => { setActiveTab('admin'); if(onClose) onClose(); }}
            className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border-2 ${activeTab === 'admin' ? 'bg-[var(--green-whatsapp-dark)] text-white border-[var(--green-whatsapp-dark)]' : 'border-[var(--green-whatsapp-dark)]/20 text-[var(--green-whatsapp)] hover:bg-black/5'}`}
          >
            <span className="text-xl min-w-[24px] text-center">👑</span>
            {expanded && <span className="text-[11px] font-black uppercase whitespace-nowrap tracking-widest">Gestão CEO</span>}
          </button>
        )}

        {groups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {expanded && (
              <h3 className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2 opacity-50">
                {group.label}
              </h3>
            )}
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); if(onClose) onClose(); }}
                className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all ${activeTab === item.id ? 'bg-[var(--border)] text-[var(--green-whatsapp)] shadow-lg border border-[var(--border)]' : 'text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-primary)]'}`}
              >
                <span className={`text-xl min-w-[24px] text-center transition-transform ${activeTab === item.id ? 'scale-110 opacity-100' : 'opacity-60'}`}>{item.icon}</span>
                {expanded && <span className="text-[13px] font-bold whitespace-nowrap tracking-tight">{item.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      
      <div className="p-4 border-t border-[var(--border)] space-y-3 bg-[var(--bg-body)]">
        <button 
          onClick={() => window.alert('Envie seu feedback para o desenvolvedor!')}
          className={`w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)] border border-[var(--green-whatsapp)]/20 hover:bg-[var(--green-whatsapp)]/20 transition-all ${!expanded && 'hidden'}`}
        >
          <span className="text-lg">💬</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Feedback Beta</span>
        </button>
        <p className={`text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] italic text-center ${!expanded && 'hidden'}`}>Audit IA 3.1 PRO</p>
      </div>
    </aside>
  );
};

export default Sidebar;