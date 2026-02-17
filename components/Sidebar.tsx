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

  const items = [
    { id: 'chat', label: 'Mentor IA', icon: '💬' },
    { id: 'dash', label: 'Dashboard', icon: '📊' },
    { id: 'goals', label: 'Metas', icon: '🎯' },
    { id: 'cc', label: 'Cartão de Crédito', icon: '💳' },
    { id: 'reminders', label: 'Lembretes', icon: '⏰' },
    { id: 'resumo', label: 'Resumo Anual', icon: '📅' },
    { id: 'score', label: 'Health Score', icon: '📈' },
    { id: 'stress', label: 'Stress Test', icon: '🧠' },
    { id: 'profile', label: 'Meu Perfil', icon: '👤' },
    { id: 'config', label: 'Ajustes IA', icon: '⚙️' },
  ];

  return (
    <aside className={`bg-[#111B21] border-r border-[#2A3942] transition-all duration-300 flex flex-col h-full text-white shadow-2xl relative ${expanded ? 'w-72' : 'w-0 overflow-hidden'}`}>
      <div className="p-4 flex items-center justify-between h-[64px] shrink-0 border-b border-[#2A3942] bg-[#202C33]">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 bg-[#00A884] rounded-lg flex items-center justify-center text-white font-black italic text-xs shadow-lg shadow-[#00A884]/20 border border-white/10 shrink-0">GB</div>
          {expanded && (
            <span className="font-black italic text-[#00A884] text-xl tracking-tighter animate-fade whitespace-nowrap">GBFinancer</span>
          )}
        </div>
        
        {/* Mobile Close Button */}
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-[#8696A0] lg:hidden block">
          ✕
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
        {isAdmin && (
          <button
            onClick={() => { setActiveTab('admin'); if(onClose) onClose(); }}
            className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all mb-4 border-2 ${activeTab === 'admin' ? 'bg-[#008069] text-white border-[#008069]' : 'border-[#008069]/20 text-[#00A884] hover:bg-white/5'}`}
          >
            <span className="text-xl min-w-[24px] text-center">👑</span>
            {expanded && <span className="text-[11px] font-black uppercase whitespace-nowrap tracking-widest">Gestão CEO</span>}
          </button>
        )}

        {items.map(item => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); if(onClose) onClose(); }}
            className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all ${activeTab === item.id ? 'bg-[#2A3942] text-[#00A884] shadow-lg border border-[#3B4A54]' : 'text-[#8696A0] hover:bg-white/5 hover:text-[#E9EDEF]'}`}
          >
            <span className={`text-xl min-w-[24px] text-center transition-transform ${activeTab === item.id ? 'scale-110 opacity-100' : 'opacity-60'}`}>{item.icon}</span>
            {expanded && <span className="text-[13px] font-bold whitespace-nowrap tracking-tight">{item.label}</span>}
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-[#2A3942] text-center bg-[#202C33]">
        <p className={`text-[9px] font-black uppercase tracking-[0.2em] text-[#8696A0] italic ${!expanded && 'hidden'}`}>Audit IA 3.1 PRO</p>
      </div>
    </aside>
  );
};

export default Sidebar;