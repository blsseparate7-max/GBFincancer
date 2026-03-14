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
    chat: 'Mentor IA',
    dash: 'Dashboard',
    goals: 'Metas Financeiras',
    cc: 'Cartão de Crédito',
    reminders: 'Lembretes',
    messages: 'Mensagens',
    resumo: 'Resumo Anual',
    score: 'Score Financeiro',
    stress: 'Stress Test',
    profile: 'Meu Perfil',
    config: 'Ajustes IA',
    admin: 'Gestão CEO',
    calendar: 'Calendário',
    wallets: 'Carteiras',
    debts: 'Endividamento',
    insights: 'Caminho Financeiro',
    extrato: 'Extrato Detalhado',
    categories: 'Categorias'
  };

  return (
    <header className="h-[80px] flex-none bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-6 z-[150] relative">
      {/* Esquerda: Botão Toggle $ */}
      <div className="w-12 flex justify-start">
        <button 
          onClick={onToggleSidebar} 
          className="w-12 h-12 flex items-center justify-center bg-[var(--green-whatsapp)] text-white rounded-2xl hover:bg-[var(--green-whatsapp-dark)] transition-all active:scale-90 shadow-xl shadow-[var(--green-whatsapp)]/20 border border-white/10"
          title="Menu Principal"
        >
          <span className="text-2xl font-black italic">$</span>
        </button>
      </div>

      {/* Centro: Título da Página */}
      <div className="flex flex-col items-center flex-1 min-w-0">
        <h1 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.3em] italic truncate max-w-full flex items-center gap-2">
          {labels[activeTab] || 'GBFinancer'}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1.5 bg-[var(--green-whatsapp)]/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-[var(--green-whatsapp)] rounded-full animate-pulse"></span>
            <span className="text-[8px] text-[var(--green-whatsapp)] font-black uppercase tracking-widest">Auditoria Ativa</span>
          </div>
        </div>
      </div>

      {/* Direita: Avatar com Dropdown */}
      <div className="w-12 flex justify-end relative">
        <button 
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-12 h-12 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] flex items-center justify-center overflow-hidden shadow-lg active:scale-95 transition-all group"
        >
          {photoURL ? (
            <img src={photoURL} alt="Perfil" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--green-whatsapp)]/10">
              <span className="text-lg font-black text-[var(--green-whatsapp)]">{userName.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-[160]" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 top-14 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] shadow-2xl py-3 z-[170] animate-in fade-in slide-in-from-top-4 duration-300 overflow-hidden">
              <div className="px-4 py-2 mb-2 border-b border-[var(--border)]">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Conectado como</p>
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{userName}</p>
              </div>
              
              <button 
                onClick={() => { onNavigate('profile'); setShowDropdown(false); }}
                className="w-full px-5 py-3 text-left text-[11px] font-black text-[var(--text-primary)] uppercase tracking-widest hover:bg-[var(--green-whatsapp)]/5 hover:text-[var(--green-whatsapp)] flex items-center gap-4 transition-colors"
              >
                <span className="text-lg">👤</span> Meu Perfil
              </button>
              
              <button 
                onClick={() => { onNavigate('config'); setShowDropdown(false); }}
                className="w-full px-5 py-3 text-left text-[11px] font-black text-[var(--text-primary)] uppercase tracking-widest hover:bg-[var(--green-whatsapp)]/5 hover:text-[var(--green-whatsapp)] flex items-center gap-4 transition-colors"
              >
                <span className="text-lg">⚙️</span> Ajustes IA
              </button>

              <div className="h-px bg-[var(--border)] my-2 mx-4" />
              
              <button 
                onClick={() => { onLogout(); setShowDropdown(false); }}
                className="w-full px-5 py-3 text-left text-[11px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-500/5 flex items-center gap-4 transition-colors"
              >
                <span className="text-lg">🚪</span> Sair da Conta
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;