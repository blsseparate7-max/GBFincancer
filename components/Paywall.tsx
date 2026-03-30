
import React, { useState } from 'react';
import { UserSession } from '../types';
import { handleKiwifyRedirect } from '../services/checkoutService';
import { OAUTH_CONFIG } from '../constants';

interface PaywallProps {
  user: UserSession;
  onLogout: () => void;
}

const Paywall: React.FC<PaywallProps> = ({ user, onLogout }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const checkoutId = OAUTH_CONFIG.KIWIFY_CHECKOUT_ID;

  const handleSubscribe = () => {
    handleKiwifyRedirect(user.uid, checkoutId);
  };

  if (isDismissed) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[1000] p-4 animate-slide-up">
        <div className="bg-rose-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black italic">!</div>
            <p className="text-[10px] font-black uppercase tracking-widest">Acesso Expirado - Assine para liberar todas as funções</p>
          </div>
          <button 
            onClick={handleSubscribe}
            className="bg-white text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
          >
            Assinar Agora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-[#0B141A]/90 backdrop-blur-md overflow-hidden">
      <div className="absolute inset-0 whatsapp-pattern opacity-[0.03] pointer-events-none"></div>

      <div className="w-full max-w-[420px] relative z-10 animate-fade text-center">
        <div className="w-20 h-20 bg-rose-500 rounded-[2.2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-rose-500/20 text-white text-4xl font-black italic transform -rotate-3 border-4 border-white/10">
          !
        </div>
        
        <div className="bg-[#111B21] p-8 rounded-[2.5rem] shadow-2xl border border-[#2A3942]/60 backdrop-blur-sm">
          <header className="mb-8">
            <h2 className="text-2xl font-black text-[#E9EDEF] tracking-tight uppercase">Seu acesso expirou</h2>
            <p className="text-sm text-[#8696A0] font-medium mt-3 leading-relaxed">
              Seu período de teste terminou ou sua assinatura não está ativa. 
              Assine agora para continuar usando o sistema e manter sua vida financeira organizada.
            </p>
          </header>

          <div className="space-y-4">
            <button 
              onClick={handleSubscribe}
              className="w-full bg-[#00A884] text-white font-black py-4 rounded-2xl text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-[#00A884]/10 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              Assinar agora
            </button>

            <button 
              onClick={() => setIsDismissed(true)}
              className="w-full bg-[#202C33] text-[#E9EDEF] font-bold py-3 rounded-2xl text-[10px] uppercase tracking-[0.1em] hover:bg-[#2A3942] transition-all"
            >
              Apenas visualizar (Limitado)
            </button>

            <button 
              onClick={onLogout}
              className="w-full bg-transparent text-[#8696A0] font-bold py-2 rounded-2xl text-[10px] uppercase tracking-[0.1em] hover:text-[#E9EDEF] transition-all"
            >
              Sair da conta
            </button>
          </div>
        </div>

        <p className="mt-8 text-[10px] font-black text-[#8696A0]/40 uppercase tracking-widest">
          Dúvidas? Entre em contato com nosso suporte.
        </p>
      </div>
    </div>
  );
};

export default Paywall;
