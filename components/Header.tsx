
import React from 'react';

interface HeaderProps {
  activeTab: string;
  userName: string;
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, userName, onToggleSidebar }) => {
  const labels: Record<string, string> = {
    chat: 'Mentor IA',
    dash: 'Dashboard',
    goals: 'Metas',
    cc: 'Cartão de Crédito',
    reminders: 'Lembretes',
    messages: 'Mensagens',
    resumo: 'Resumo Anual',
    score: 'Score',
    stress: 'Stress Test',
    profile: 'Perfil',
    config: 'Configurações'
  };

  return (
    <header className="h-[60px] bg-[#f0f2f5] border-b border-[#d1d7db] flex items-center justify-between px-4 shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="p-2 hover:bg-[#e9edef] rounded-full">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="#54656f">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path>
          </svg>
        </button>
        <div className="flex flex-col">
          <span className="text-[15px] font-bold text-[#111b21] leading-none tracking-tight">
            {labels[activeTab] || 'GBFinancer'}
          </span>
          <span className="text-[11px] text-[#00a884] font-bold mt-0.5 animate-pulse">Online agora</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#dfe5e7] rounded-full flex items-center justify-center text-[#54656f] font-black text-xs border border-[#d1d7db] overflow-hidden shadow-sm">
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
};

export default Header;
