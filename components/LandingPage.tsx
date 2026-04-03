import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, MessageSquare, PieChart, CreditCard, Target, ArrowRight, ShieldCheck, Zap, AlertCircle, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const carouselRef = React.useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -600 : 600;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

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

        {/* Veja o sistema em ação */}
        <section className="mt-32 relative z-10 max-w-7xl mx-auto px-4 overflow-hidden">
          <header className="text-center mb-16">
            <h2 className="text-[10px] font-black text-[#00A884] uppercase tracking-[0.5em] mb-4">Experiência Premium</h2>
            <h3 className="text-4xl font-black tracking-tighter uppercase italic">Veja o sistema em ação</h3>
          </header>

          <div className="relative group/carousel">
            {/* Desktop Navigation Arrows */}
            <button 
              onClick={() => scrollCarousel('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 z-20 w-12 h-12 bg-[#111B21] border border-[#2A3942] rounded-full hidden md:flex items-center justify-center text-[#8696A0] hover:text-white hover:border-[#00A884] transition-all shadow-xl opacity-0 group-hover/carousel:opacity-100"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => scrollCarousel('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 z-20 w-12 h-12 bg-[#111B21] border border-[#2A3942] rounded-full hidden md:flex items-center justify-center text-[#8696A0] hover:text-white hover:border-[#00A884] transition-all shadow-xl opacity-0 group-hover/carousel:opacity-100"
            >
              <ChevronRight size={24} />
            </button>

            {/* Carousel Container */}
            <div 
              ref={carouselRef}
              className="flex gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-12 px-4 md:px-12"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* A) Chat Card */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="flex-shrink-0 w-[85vw] md:w-[600px] snap-center bg-[#111B21] rounded-[3rem] border border-[#2A3942] p-8 md:p-10 shadow-2xl relative overflow-hidden group hover:border-[#00A884]/30 transition-all"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#00A884]/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-10 h-10 bg-[#00A884] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#00A884]/20">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8696A0]">Interface de Conversa</span>
                    <h4 className="text-lg font-black text-white uppercase italic tracking-tight">Chat Inteligente</h4>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-[#202C33] p-6 rounded-3xl rounded-tl-none max-w-[90%] border border-white/5 shadow-xl">
                    <p className="text-[10px] font-black text-[#00A884] uppercase tracking-widest mb-3">Resumo Rápido</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-[#8696A0]">Saldo:</span>
                        <span className="text-white">R$ 1.280,00</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-[#8696A0]">Entradas:</span>
                        <span className="text-[#00A884]">R$ 2.000,00</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-[#8696A0]">Saídas:</span>
                        <span className="text-rose-500">R$ 720,00</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-[#00A884]/10 p-6 rounded-3xl rounded-tr-none max-w-[90%] border border-[#00A884]/20 ml-auto shadow-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={14} className="text-[#00A884]" />
                      <span className="text-[10px] font-black text-[#00A884] uppercase tracking-widest">Lançamento Confirmado</span>
                    </div>
                    <p className="text-sm font-black text-white italic">R$ 50,00 — Mercado Muffato</p>
                  </div>
                </div>
              </motion.div>

              {/* B) Dashboard Card (Pie Chart) */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="flex-shrink-0 w-[85vw] md:w-[600px] snap-center bg-[#111B21] rounded-[3rem] border border-[#2A3942] p-8 md:p-10 shadow-2xl relative overflow-hidden group hover:border-[#00A884]/30 transition-all"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#00A884] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#00A884]/20">
                      <PieChart size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8696A0]">Visão Geral</span>
                      <h4 className="text-lg font-black text-white uppercase italic tracking-tight">Dashboard</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-[#8696A0] uppercase tracking-widest mb-1">Saldo Disponível</p>
                    <p className="text-2xl font-black text-white italic tracking-tighter">R$ 1.280,00</p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-10">
                  {/* Pie Chart SVG */}
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90">
                      {/* Alimentação 40% */}
                      <circle r="16" cx="16" cy="16" fill="transparent" stroke="#00A884" strokeWidth="32" strokeDasharray="40 100" />
                      {/* Transporte 20% */}
                      <circle r="16" cx="16" cy="16" fill="transparent" stroke="#128c7e" strokeWidth="32" strokeDasharray="20 100" strokeDashoffset="-40" />
                      {/* Lazer 10% */}
                      <circle r="16" cx="16" cy="16" fill="transparent" stroke="#34b7f1" strokeWidth="32" strokeDasharray="10 100" strokeDashoffset="-60" />
                      {/* Outros 30% */}
                      <circle r="16" cx="16" cy="16" fill="transparent" stroke="#202C33" strokeWidth="32" strokeDasharray="30 100" strokeDashoffset="-70" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 bg-[#111B21] rounded-full flex items-center justify-center border border-[#2A3942]">
                        <span className="text-[10px] font-black text-white uppercase italic">Gastos</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 w-full">
                    <p className="text-[9px] font-black text-[#8696A0] uppercase tracking-[0.2em]">Onde seu dinheiro está indo</p>
                    {[
                      { name: 'Alimentação', val: 420, p: 40, color: '#00A884' },
                      { name: 'Transporte', val: 180, p: 20, color: '#128c7e' },
                      { name: 'Lazer', val: 120, p: 10, color: '#34b7f1' }
                    ].map((item, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-black uppercase italic">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-white">{item.name}</span>
                          </div>
                          <span className="text-[#8696A0]">R$ {item.val}</span>
                        </div>
                        <div className="h-1 w-full bg-[#202C33] rounded-full overflow-hidden">
                          <div className="h-full" style={{ width: `${item.p}%`, backgroundColor: item.color }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* C) Estou Endividado Card */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="flex-shrink-0 w-[85vw] md:w-[600px] snap-center bg-[#111B21] rounded-[3rem] border border-[#2A3942] p-8 md:p-10 shadow-2xl relative overflow-hidden group hover:border-rose-500/30 transition-all"
              >
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-10 h-10 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                    <Zap size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8696A0]">Recuperação</span>
                    <h4 className="text-lg font-black text-white uppercase italic tracking-tight">Estou Endividado</h4>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="bg-[#202C33] p-6 rounded-[2rem] border border-white/5 shadow-xl">
                    <p className="text-[9px] font-black text-[#8696A0] uppercase tracking-widest mb-2">Dívida Total</p>
                    <p className="text-2xl font-black text-rose-500 italic tracking-tighter leading-none">R$ 4.800,00</p>
                  </div>
                  <div className="bg-[#202C33] p-6 rounded-[2rem] border border-white/5 shadow-xl">
                    <p className="text-[9px] font-black text-[#8696A0] uppercase tracking-widest mb-2">Parcela Mensal</p>
                    <p className="text-2xl font-black text-white italic tracking-tighter leading-none">R$ 300,00</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] font-black text-[#8696A0] uppercase tracking-widest mb-1">Progresso de Quitação</p>
                      <p className="text-sm font-black text-white uppercase italic">22% Concluído</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-[#00A884] uppercase tracking-widest mb-1">Previsão</p>
                      <p className="text-xs font-black text-white uppercase italic">16 meses</p>
                    </div>
                  </div>
                  <div className="h-4 w-full bg-[#202C33] rounded-full overflow-hidden p-1 border border-white/5">
                    <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.3)]" style={{ width: '22%' }}></div>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-4">
                    <AlertCircle size={20} className="text-rose-500 shrink-0" />
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-relaxed">
                      Prioridade: Renegociar juros do cartão de crédito para acelerar quitação.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* D) Score Card */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="flex-shrink-0 w-[85vw] md:w-[600px] snap-center bg-[#111B21] rounded-[3rem] border border-[#2A3942] p-8 md:p-10 shadow-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all"
              >
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8696A0]">Saúde Financeira</span>
                    <h4 className="text-lg font-black text-white uppercase italic tracking-tight">Score GB</h4>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-10 py-2">
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="80" cy="80" r="70" fill="none" stroke="#202C33" strokeWidth="12" />
                      <motion.circle 
                        initial={{ strokeDashoffset: 440 }}
                        whileInView={{ strokeDashoffset: 440 * (1 - 0.74) }}
                        cx="80" cy="80" r="70" fill="none" stroke="url(#score-gradient-landing)" strokeWidth="12" 
                        strokeDasharray="440"
                        strokeLinecap="round"
                        transition={{ duration: 2, ease: "easeOut" }}
                      />
                      <defs>
                        <linearGradient id="score-gradient-landing" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black italic tracking-tighter text-white leading-none">74</span>
                      <span className="text-[10px] font-black text-[#8696A0] uppercase tracking-widest mt-2">Pontos</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-6 text-center md:text-left">
                    <div className="inline-block px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Status: Em evolução constante</p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-[#8696A0] leading-relaxed italic">
                        "Você está melhorando seu controle financeiro. Seu comportamento de gastos este mês está 15% mais eficiente que o anterior."
                      </p>
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <Sparkles size={14} className="text-amber-500" />
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Dica da IA: Mantenha o foco em lazer</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Carousel Navigation Hints */}
            <div className="flex justify-center gap-2 mt-4 md:hidden">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-[#00A884]' : 'bg-[#2A3942]'}`} />
              ))}
            </div>
          </div>
        </section>
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
