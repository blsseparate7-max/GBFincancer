import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, MessageSquare, PieChart, CreditCard, Target, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import Auth from './Auth';
import LegalModal from './LegalModal';
import { UserSession } from '../types';

interface LandingPageProps {
  onLogin: (session: UserSession) => void;
  onOpenSupport: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onOpenSupport }) => {
  const [authMode, setAuthMode] = useState<'none' | 'login' | 'signup'>('none');
  const [legalView, setLegalView] = useState<'terms' | 'privacy' | 'none'>('none');

  if (authMode !== 'none') {
    return (
      <div className="min-h-screen bg-[#0B141A] relative">
        <button 
          onClick={() => setAuthMode('none')}
          className="absolute top-6 left-6 z-[100] text-[#8696A0] hover:text-white flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all"
        >
          <ArrowRight className="w-4 h-4 rotate-180" /> Voltar
        </button>
        <Auth 
          key={authMode}
          onLogin={onLogin} 
          onOpenSupport={onOpenSupport} 
          initialView={authMode === 'login' ? 'login' : 'signup'} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] selection:bg-[#00A884]/30">
      <div className="absolute inset-0 whatsapp-pattern opacity-[0.03] pointer-events-none"></div>

      {/* Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00A884] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00A884]/20 text-white text-xl font-black italic transform -rotate-3 border-2 border-white/10">
            GB
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">GBFinancer</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-[#8696A0]">
          <a href="#beneficios" className="hover:text-[#00A884] transition-colors">Benefícios</a>
          <a href="#como-funciona" className="hover:text-[#00A884] transition-colors">Como funciona</a>
          <button 
            onClick={() => setAuthMode('login')}
            className="text-[#E9EDEF] hover:text-[#00A884] transition-colors"
          >
            Já sou cliente
          </button>
          <button 
            onClick={() => setAuthMode('signup')}
            className="bg-[#00A884] text-white px-6 py-3 rounded-xl shadow-lg shadow-[#00A884]/20 hover:bg-[#00C99D] transition-all active:scale-95"
          >
            Teste Grátis
          </button>
        </div>
        <button 
          onClick={() => setAuthMode('login')}
          className="md:hidden text-[10px] font-black uppercase tracking-widest text-[#00A884]"
        >
          Entrar
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32 px-6 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-[0.9]">
            Organize sua vida financeira <br className="hidden md:block" />
            <span className="text-[#00A884] italic">de forma simples</span>
          </h1>
          <p className="text-lg md:text-xl text-[#8696A0] max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
            Controle gastos, metas, cartão, lembretes e tenha clareza do seu dinheiro todos os dias. 
            Tudo em um só lugar, com inteligência artificial.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setAuthMode('signup')}
              className="w-full sm:w-auto bg-[#00A884] text-white font-black px-10 py-5 rounded-2xl text-sm uppercase tracking-widest shadow-2xl shadow-[#00A884]/30 hover:bg-[#00C99D] transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              Começar teste grátis <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setAuthMode('login')}
              className="w-full sm:w-auto bg-[#111B21] text-[#E9EDEF] border border-[#2A3942] font-black px-10 py-5 rounded-2xl text-sm uppercase tracking-widest hover:bg-[#202C33] transition-all active:scale-95"
            >
              Já sou cliente
            </button>
          </div>
          <p className="mt-6 text-[10px] font-black text-[#8696A0]/40 uppercase tracking-[0.3em]">
            7 dias grátis • Sem cartão de crédito • Cancele quando quiser
          </p>
        </motion.div>

        {/* App Preview Mockup */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mt-24 relative max-w-5xl mx-auto"
        >
          <div className="absolute -inset-4 bg-gradient-to-b from-[#00A884]/20 to-transparent blur-3xl rounded-full opacity-50"></div>
          <div className="relative bg-[#111B21] rounded-[2.5rem] border border-[#2A3942] shadow-2xl overflow-hidden aspect-video flex items-center justify-center group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#00A884]/5 to-transparent"></div>
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-[#00A884]/10 rounded-full flex items-center justify-center mx-auto border border-[#00A884]/20 group-hover:scale-110 transition-transform duration-500">
                <Zap className="w-10 h-10 text-[#00A884]" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#8696A0]">Visualização do Sistema</p>
              <p className="text-xs text-[#8696A0]/60 italic">Mockup da interface premium</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Benefits Section */}
      <section id="beneficios" className="relative z-10 py-32 px-6 bg-[#111B21]/50">
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-20">
            <h2 className="text-[10px] font-black text-[#00A884] uppercase tracking-[0.5em] mb-4">Por que escolher o GB?</h2>
            <h3 className="text-4xl font-black tracking-tighter uppercase italic">Tudo o que você precisa</h3>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: MessageSquare, title: "Chat Inteligente", desc: "Registre gastos e tire dúvidas financeiras conversando com nossa IA." },
              { icon: PieChart, title: "Clareza Total", desc: "Gráficos automáticos mostram exatamente para onde seu dinheiro está indo." },
              { icon: CreditCard, title: "Controle de Cartão", desc: "Gerencie faturas e limites de todos os seus cartões em um só lugar." },
              { icon: Target, title: "Metas e Carteiras", desc: "Organize seus objetivos e separe seu dinheiro por categorias e bancos." }
            ].map((item, i) => (
              <div key={i} className="bg-[#111B21] p-8 rounded-[2rem] border border-[#2A3942] hover:border-[#00A884]/50 transition-all group">
                <div className="w-12 h-12 bg-[#00A884]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <item.icon className="w-6 h-6 text-[#00A884]" />
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight mb-3">{item.title}</h4>
                <p className="text-sm text-[#8696A0] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="como-funciona" className="relative z-10 py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-20">
            <h2 className="text-[10px] font-black text-[#00A884] uppercase tracking-[0.5em] mb-4">O Caminho</h2>
            <h3 className="text-4xl font-black tracking-tighter uppercase italic">Como funciona</h3>
          </header>

          <div className="space-y-12">
            {[
              { step: "01", title: "Crie sua conta", desc: "O cadastro leva menos de 1 minuto e você já entra no sistema." },
              { step: "02", title: "Teste por 7 dias", desc: "Aproveite todas as funcionalidades premium sem pagar nada por isso." },
              { step: "03", title: "Assine e continue", desc: "Após o teste, escolha seu plano e mantenha sua vida organizada." }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-8 group">
                <div className="text-4xl font-black italic text-[#00A884]/20 group-hover:text-[#00A884] transition-colors duration-500">{item.step}</div>
                <div className="pt-2">
                  <h4 className="text-xl font-black uppercase tracking-tight mb-2">{item.title}</h4>
                  <p className="text-[#8696A0] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 text-center">
            <button 
              onClick={() => setAuthMode('signup')}
              className="bg-[#00A884] text-white font-black px-12 py-6 rounded-2xl text-sm uppercase tracking-widest shadow-2xl shadow-[#00A884]/30 hover:bg-[#00C99D] transition-all active:scale-95"
            >
              Começar agora
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-20 px-6 border-t border-[#2A3942]/40 bg-[#0B141A]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00A884] rounded-xl flex items-center justify-center text-white text-lg font-black italic transform -rotate-3">
              GB
            </div>
            <span className="text-lg font-black tracking-tighter uppercase">GBFinancer</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-[#8696A0]">
            <button onClick={() => setLegalView('terms')} className="hover:text-[#00A884] transition-colors">Termos de Uso</button>
            <button onClick={() => setLegalView('privacy')} className="hover:text-[#00A884] transition-colors">Política de Privacidade</button>
            <button onClick={onOpenSupport} className="text-[#00A884] hover:text-[#00C99D] transition-colors">Suporte</button>
          </div>

          <div className="flex items-center gap-2 opacity-40">
          </div>
        </div>
        <div className="mt-12 text-center text-[9px] font-black text-[#8696A0]/20 uppercase tracking-[0.5em]">
          © 2026 GBFinancer • Todos os direitos reservados
        </div>
      </footer>
      <LegalModal type={legalView} onClose={() => setLegalView('none')} />
    </div>
  );
};

export default LandingPage;
