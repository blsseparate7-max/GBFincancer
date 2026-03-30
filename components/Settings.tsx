
import React from 'react';
import { UserSession } from '../types';
import { handleKiwifyRedirect } from '../services/checkoutService';
import { OAUTH_CONFIG } from '../constants';

interface SettingsProps {
  user: UserSession;
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ user, onLogout }) => {
  const checkoutId = OAUTH_CONFIG.KIWIFY_CHECKOUT_ID;

  return (
    <div className="p-6 space-y-6 animate-fade min-h-full">
      <header className="mb-8">
        <h2 className="text-[10px] font-black text-[#667781] uppercase tracking-[0.4em] mb-1">Preferências de Sistema</h2>
        <h1 className="text-3xl font-black text-[#111b21] uppercase italic tracking-tighter">Configurações</h1>
      </header>

      <div className="bg-white rounded-3xl border border-[#d1d7db] overflow-hidden shadow-sm">
        <div className="p-5 border-b border-[#f0f2f5]">
          <h4 className="text-sm font-bold text-[#111b21] uppercase tracking-tighter">Sua Assinatura</h4>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#667781] uppercase font-black tracking-widest">Status Atual</p>
              <p className={`text-xs font-black uppercase ${user.subscriptionStatus === 'active' ? 'text-[#00a884]' : 'text-rose-500'}`}>
                {user.subscriptionStatus === 'active' ? 'Ativa' : user.subscriptionStatus === 'trial' ? 'Teste Grátis' : 'Inativa'}
              </p>
            </div>
            {user.subscriptionStatus !== 'active' && (
              <button 
                onClick={() => handleKiwifyRedirect(user.uid, checkoutId)}
                className="bg-[#00a884] text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg shadow-[#00a884]/20 active:scale-95 transition-all"
              >
                Assinar Agora
              </button>
            )}
          </div>
        </div>

        <div className="p-5 border-b border-[#f0f2f5] flex justify-between items-center">
          <div>
            <h4 className="text-sm font-bold text-[#111b21]">Notificações de Alerta</h4>
            <p className="text-[10px] text-[#667781]">Avisar quando atingir 80% do limite</p>
          </div>
          <div className="w-10 h-5 bg-[#00a884] rounded-full relative"><div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div></div>
        </div>

        <div className="p-5 border-b border-[#f0f2f5] flex justify-between items-center">
          <div>
            <h4 className="text-sm font-bold text-[#111b21]">Backup em Nuvem</h4>
            <p className="text-[10px] text-[#667781]">Sincronização automática com Firebase</p>
          </div>
          <div className="w-10 h-5 bg-[#00a884] rounded-full relative"><div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div></div>
        </div>

        <div className="p-5 border-b border-[#f0f2f5] flex justify-between items-center">
          <div>
            <h4 className="text-sm font-bold text-[#111b21]">Modo Escuro (Em breve)</h4>
            <p className="text-[10px] text-[#667781]">O sistema está fixado no modo Light</p>
          </div>
          <div className="w-10 h-5 bg-[#d1d7db] rounded-full relative"><div className="w-4 h-4 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm"></div></div>
        </div>
      </div>

      <button 
        onClick={onLogout}
        className="w-full bg-white text-rose-500 font-black py-5 rounded-2xl border border-rose-100 shadow-sm uppercase tracking-widest text-xs"
      >
        Sair da Conta
      </button>

      <p className="text-center text-[10px] font-black text-[#667781] uppercase tracking-widest italic opacity-40">GBFinancer Version 3.1.0-PRO</p>
    </div>
  );
};

export default Settings;
