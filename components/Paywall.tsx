
import React from 'react';
import MercadoPagoButton from './MercadoPagoButton';

interface PaywallProps {
  userName: string;
  onPay: () => void;
  onLogout: () => void;
}

const Paywall: React.FC<PaywallProps> = ({ userName, onPay, onLogout }) => {
  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] animate-in fade-in duration-500 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-[#075e54] pt-12 pb-10 px-8 text-center text-white rounded-t-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none whatsapp-bg"></div>
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-[2.5rem] border border-white/20 flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter italic">Conta Bloqueada</h2>
            <p className="text-xs opacity-70 mt-2">Olá {userName.split(' ')[0]}, sua assinatura expirou.</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-b-[3rem] shadow-xl border border-gray-100 text-center">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-6">Renovação Recomendada</p>
          
          <div className="p-6 rounded-[2rem] border-4 border-emerald-500 bg-emerald-50 text-left mb-8">
            <div className="flex justify-between items-center mb-1">
              <span className="font-black text-gray-900 uppercase italic">Anual Premium</span>
              <span className="text-xl font-black text-emerald-600">R$ 99,90</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold">ECONOMIZE 20% NA ANUIDADE</p>
            <ul className="mt-4 space-y-2">
              <li className="text-[9px] font-black text-slate-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                Consultoria IA Ilimitada
              </li>
              <li className="text-[9px] font-black text-slate-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                Acesso Multi-plataforma
              </li>
            </ul>
          </div>

          <div className="space-y-4">
             <MercadoPagoButton />
             <button 
               onClick={onPay}
               className="w-full text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-emerald-500 transition-colors"
             >
               Simular Liberação (Teste)
             </button>
             <button 
               onClick={onLogout}
               className="w-full text-rose-500 font-black py-4 text-[10px] uppercase tracking-widest hover:bg-rose-50 rounded-2xl transition-all"
             >
               Trocar de Conta
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paywall;
