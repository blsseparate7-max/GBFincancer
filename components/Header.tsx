import React, { useState } from 'react';

interface HeaderProps {
  activeTab: string;
  userName: string;
  photoURL?: string;
  onToggleSidebar: () => void;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, userName, photoURL, onToggleSidebar, onNavigate, onLogout }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const labels: Record<string, string> = {
    chat: 'Chat',
    dash: 'Dashboard',
    goals: 'Metas',
    cc: 'Cartão',
    reminders: 'Lembretes',
    messages: 'Mensagens',
    resumo: 'Resumo Anual',
    score: 'Score',
    stress: 'Stress Test',
    profile: 'Perfil',
    config: 'Configurações',
    admin: 'Gestão CEO'
  };

  return (
    <header className="h-[64px] flex-none bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-4 z-[150] relative">
      {/* Esquerda: Botão Toggle $ (Único controle do menu) */}
      <div className="w-12 flex justify-start">
        <button 
          onClick={onToggleSidebar} 
          className="w-10 h-10 flex items-center justify-center bg-[var(--green-whatsapp)] text-white rounded-full hover:bg-[var(--green-whatsapp-dark)] transition-all active:scale-90 shadow-lg"
          title="Menu"
        >
          <span className="text-xl font-black italic">$</span>
        </button>
      </div>

      {/* Centro: Título da Página */}
      <div className="flex flex-col items-center flex-1 min-w-0">
        <h1 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-[0.15em] italic truncate max-w-full flex items-center gap-2">
          {labels[activeTab] || 'GBFinancer'}
          <span className="text-[8px] not-italic font-black bg-[var(--green-whatsapp)] text-white px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">Beta</span>
        </h1>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-[var(--green-whatsapp)] rounded-full animate-pulse"></span>
          <span className="text-[9px] text-[var(--green-whatsapp)] font-black uppercase tracking-widest">Auditoria Ativa</span>
        </div>
      </div>

      {/* Direita: Avatar com Dropdown */}
      <div className="w-12 flex justify-end relative">
        <button 
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-10 h-10 bg-[var(--bg-body)] rounded-full border border-[var(--border)] flex items-center justify-center overflow-hidden shadow-md active:scale-95 transition-all"
        >
          {photoURL ? (
            <img src={photoURL} alt="Perfil" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--green-whatsapp)]/20">
              <span className="text-sm font-black text-[var(--green-whatsapp)]">{userName.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-[160]" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 top-12 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl py-2 z-[170] animate-fade overflow-hidden">
              <button 
                onClick={() => { onNavigate('profile'); setShowDropdown(false); }}
                className="w-full px-4 py-3 text-left text-[11px] font-black text-[var(--text-primary)] uppercase tracking-widest hover:bg-black/5 flex items-center gap-3"
              >
                <span>👤</span> Meu Perfil
              </button>
              <button 
                onClick={() => { onNavigate('profile'); setShowDropdown(false); }}
                className="w-full px-4 py-3 text-left text-[11px] font-black text-[var(--text-primary)] uppercase tracking-widest hover:bg-black/5 flex items-center gap-3"
              >
                <span>✏️</span> Editar Perfil
              </button>
              <div className="h-px bg-[var(--border)] my-1 mx-2" />
              <button 
                onClick={() => { onLogout(); setShowDropdown(false); }}
                className="w-full px-4 py-3 text-left text-[11px] font-black text-rose-500 uppercase tracking-widest hover:bg-black/5 flex items-center gap-3"
              >
                <span>🚪</span> Sair
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;