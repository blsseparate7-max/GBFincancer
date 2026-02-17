
import React from 'react';

interface WelcomeOnboardingProps {
  userName: string;
  onFinish: () => void;
}

const WelcomeOnboarding: React.FC<WelcomeOnboardingProps> = ({ userName, onFinish }) => {
  return (
    <div className="fixed inset-0 z-[6000] bg-[#0B141A] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade">
      <div className="absolute inset-0 whatsapp-pattern opacity-[0.05] pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-lg bg-[#111B21] rounded-[3rem] shadow-2xl border border-[#2A3942]/60 flex flex-col max-h-[90vh]">
        
        {/* Header com Logo */}
        <div className="p-8 pb-4 text-center">
          <div className="w-20 h-20 bg-[#00A884] rounded-[2.2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#00A884]/20 text-white text-4xl font-black italic transform -rotate-3 border-4 border-white/10">
            GB
          </div>
          <h2 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter">Bem-vindo ao GBFinancer, {userName.split(' ')[0]}!</h2>
          <p className="text-[11px] font-bold text-[#8696A0] uppercase tracking-[0.2em] mt-2 italic">A clareza que seu bolso merece.</p>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto px-8 py-4 no-scrollbar space-y-8">
          
          <section>
            <h3 className="text-[10px] font-black text-[#00A884] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#00A884] rounded-full"></span> 
              Por que existo?
            </h3>
            <p className="text-sm text-[#E9EDEF] font-medium leading-relaxed opacity-90">
              Para te dar clareza e controle absoluto sobre sua vida financeira, sem planilhas chatas ou complicações. Sou sua auditoria particular 24h por dia.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-[#00A884] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#00A884] rounded-full"></span> 
              Como Funciona?
            </h3>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                <span className="text-xl">💬</span>
                <div>
                  <h4 className="text-xs font-black text-[#E9EDEF] uppercase">Chat Inteligente</h4>
                  <p className="text-[11px] text-[#8696A0] leading-tight mt-1">Registre entradas e gastos conversando comigo, igual no WhatsApp.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-xl">📊</span>
                <div>
                  <h4 className="text-xs font-black text-[#E9EDEF] uppercase">Dashboard de Resumo</h4>
                  <p className="text-[11px] text-[#8696A0] leading-tight mt-1">Acompanhe seu balanço mensal e distribuição por categorias em tempo real.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="text-xs font-black text-[#E9EDEF] uppercase">Limites e Alertas</h4>
                  <p className="text-[11px] text-[#8696A0] leading-tight mt-1">Defina tetos de gastos. Eu te aviso quando você chegar perto do limite.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-xl">💳</span>
                <div>
                  <h4 className="text-xs font-black text-[#E9EDEF] uppercase">Cartão de Crédito Real</h4>
                  <p className="text-[11px] text-[#8696A0] leading-tight mt-1">Compras no cartão não saem do saldo agora. Elas só viram gasto real quando você pagar a fatura.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-xl">🎯</span>
                <div>
                  <h4 className="text-xs font-black text-[#E9EDEF] uppercase">Cofres e Aportes</h4>
                  <p className="text-[11px] text-[#8696A0] leading-tight mt-1">Suas metas são manuais. Quando guardar no banco, atualize seu cofre aqui.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-xl">⏰</span>
                <div>
                  <h4 className="text-xs font-black text-[#E9EDEF] uppercase">Lembretes Inteligentes</h4>
                  <p className="text-[11px] text-[#8696A0] leading-tight mt-1">Nunca mais esqueça um boleto. Eu te lembro antes do vencimento.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[#202C33] p-6 rounded-3xl border border-[#2A3942]/40">
            <h4 className="text-[10px] font-black text-[#E9EDEF] uppercase tracking-widest mb-2 text-center">Proteção Garantida</h4>
            <p className="text-[10px] text-[#8696A0] font-bold text-center leading-tight">Seus dados são criptografados e acessíveis apenas por você.</p>
          </section>

        </div>

        {/* Footer com Botão */}
        <div className="p-8 pt-4">
          <button 
            onClick={onFinish}
            className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-[0.2em] text-[12px] shadow-[#00A884]/20"
          >
            Entendido, vamos começar!
          </button>
          
          <div className="mt-6 flex items-center justify-center gap-2 opacity-50">
            <svg className="w-3.5 h-3.5 text-[#8696A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <p className="text-[9px] font-black text-[#8696A0] uppercase tracking-[0.2em]">Experiência Privada e Segura</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeOnboarding;
