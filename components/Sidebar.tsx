
import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  expanded: boolean;
  setExpanded: (val: boolean) => void;
  role?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, expanded, setExpanded, role }) => {
  const isAdmin = role === 'ADMIN';

  const items = [
    { id: 'chat', label: 'Mentor IA', icon: '💬' },
    { id: 'dash', label: 'Dashboard', icon: '📊' },
    { id: 'goals', label: 'Metas', icon: '🎯' },
    { id: 'cc', label: 'Cartão de Crédito', icon: '💳' },
    { id: 'reminders', label: 'Lembretes', icon: '⏰' },
    { id: 'resumo', label: 'Resumo Anual', icon: '📅' },
    { id: 'score', label: 'Score', icon: '📈' },
    { id: 'stress', label: 'Stress', icon: '🧠' },
    { id: 'profile', label: 'Perfil', icon: '👤' },
    { id: 'config', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <aside className={`bg-[#111b21] border-r border-white/10 transition-all duration-300 flex flex-col h-full text-white ${expanded ? 'w-72' : 'w-16'}`}>
      <div className="p-4 flex items-center justify-between h-[60px] shrink-0 border-b border-white/10 bg-[#202c33]">
        {expanded && <span className="font-black italic text-[#00a884] text-xl tracking-tighter">GBFinancer</span>}
        <button onClick={() => setExpanded(!expanded)} className="p-2 hover:bg-white/10 rounded-full text-white/70">
          {expanded ? '❮' : '❯'}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-0.5">
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`w-full flex items-center gap-4 p-3 rounded-lg transition-all mb-4 border-2 ${activeTab === 'admin' ? 'bg-[#008069] text-white border-[#008069]' : 'border-[#008069]/20 text-[#00a884] hover:bg-white/5'}`}
          >
            <span className="text-xl min-w-[24px] text-center">👑</span>
            {expanded && <span className="text-[12px] font-black uppercase whitespace-nowrap tracking-widest">Gestão CEO</span>}
          </button>
        )}

        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-[#2a3942] text-[#00a884] shadow-lg' : 'text-[#8696a0] hover:bg-white/5 hover:text-white'}`}
          >
            <span className={`text-xl min-w-[24px] text-center ${activeTab === item.id ? 'opacity-100' : 'opacity-60'}`}>{item.icon}</span>
            {expanded && <span className="text-[14px] font-bold whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-white/10 text-center bg-[#202c33]">
        <p className={`text-[9px] font-black uppercase tracking-widest text-[#8696a0] ${!expanded && 'hidden'}`}>Audit IA 3.1 PRO</p>
      </div>
    </aside>
  );
};

export default Sidebar;
