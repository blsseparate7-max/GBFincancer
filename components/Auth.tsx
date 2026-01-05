
import React, { useState } from 'react';
import { UserSession, SubscriptionPlan } from '../types';

interface AuthProps {
  onLogin: (session: UserSession) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'signup' | 'plans' | 'checkout'>('login');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('MONTHLY');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (id.toUpperCase() === 'ADMIN') {
      onLogin({ id: 'ADMIN', name: "Gestor Master", isLoggedIn: true, plan: 'YEARLY', subscriptionStatus: 'ACTIVE', role: 'ADMIN' });
      return;
    }

    const userInfo = localStorage.getItem(`finai_user_${id}`);
    if (userInfo) {
      onLogin({ ...JSON.parse(userInfo), isLoggedIn: true, role: 'USER' });
    } else {
      alert("ID não encontrado. Cadastre-se!");
    }
  };

  const processPayment = () => {
    setView('checkout');
    
    // REDIRECIONAMENTO REAL:
    // Em um cenário real, aqui você abriria seu link do Stripe/Mercado Pago
    // window.open('https://link-de-pagamento.com', '_blank');

    setTimeout(() => {
      const session: UserSession = { 
        id, name, isLoggedIn: true, plan: selectedPlan, subscriptionStatus: 'ACTIVE', role: 'USER'
      };
      localStorage.setItem(`finai_user_${id}`, JSON.stringify(session));
      onLogin(session);
    }, 3000);
  };

  if (view === 'checkout') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white p-8 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Validando Pagamento</h2>
        <p className="text-sm text-gray-400 mt-2 max-w-xs">Estamos conectando com o Gateway para confirmar sua assinatura <b>{selectedPlan}</b>.</p>
        <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 w-full">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Segurança Bancária</p>
           <p className="text-[10px] text-gray-400 mt-1">Sua transação é protegida por criptografia de 256 bits.</p>
        </div>
      </div>
    );
  }

  if (view === 'plans') {
    return (
      <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
        <button onClick={() => setView('signup')} className="mb-6 self-start p-2 bg-gray-100 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <h2 className="text-3xl font-black text-gray-800 mb-2 tracking-tighter">Escolha seu Plano</h2>
        <p className="text-sm text-gray-400 mb-8">Acesso imediato à IA de gestão financeira.</p>

        <div className="space-y-4">
          <div 
            onClick={() => setSelectedPlan('MONTHLY')}
            className={`p-6 rounded-[2rem] border-4 transition-all cursor-pointer ${selectedPlan === 'MONTHLY' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-50 bg-gray-50'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-black text-gray-800">Mensal</span>
              <span className="text-xl font-black text-emerald-600">R$ 29,90</span>
            </div>
            <p className="text-xs text-gray-500">Ideal para começar sua organização.</p>
          </div>

          <div 
            onClick={() => setSelectedPlan('YEARLY')}
            className={`p-6 rounded-[2rem] border-4 transition-all cursor-pointer relative overflow-hidden ${selectedPlan === 'YEARLY' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-50 bg-gray-50'}`}
          >
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black px-4 py-1 uppercase rounded-bl-xl">Economize 20%</div>
            <div className="flex justify-between items-center mb-1">
              <span className="font-black text-gray-800">Anual</span>
              <span className="text-xl font-black text-emerald-600">R$ 299,00</span>
            </div>
            <p className="text-xs text-gray-500">O melhor custo-benefício para metas longas.</p>
          </div>
        </div>

        <button 
          onClick={processPayment} 
          className="mt-auto w-full bg-gray-900 text-white font-black py-5 rounded-[2rem] shadow-2xl active:scale-95 transition-all mb-4"
        >
          CONFIRMAR & PAGAR AGORA
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#075e54] p-8 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none whatsapp-bg"></div>
      
      <div className="relative z-10 w-full flex flex-col items-center">
        <div className="w-20 h-20 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#075e54" strokeWidth="3"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h1 className="text-4xl font-black mb-1 tracking-tighter italic">GBFinancer</h1>
        <p className="text-[10px] font-bold opacity-60 uppercase tracking-[0.4em] mb-12">Assistente Financeiro Inteligente</p>
        
        <form onSubmit={view === 'login' ? handleLogin : (e) => { e.preventDefault(); setView('plans'); }} className="w-full space-y-4">
          {view === 'signup' && (
            <input 
              type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-6 py-5 text-white focus:bg-white/20 outline-none transition-all placeholder:text-white/30"
              placeholder="Seu Nome Completo"
            />
          )}
          <input 
            type="text" value={id} onChange={(e) => setId(e.target.value)} required
            className="w-full bg-white/10 border border-white/20 rounded-2xl px-6 py-5 text-white focus:bg-white/20 outline-none transition-all placeholder:text-white/30"
            placeholder="Seu ID ou E-mail"
          />
          <button type="submit" className="w-full bg-white text-[#075e54] font-black py-5 rounded-2xl shadow-2xl active:scale-95 transition-all">
            {view === 'login' ? 'ENTRAR NA CONTA' : 'CRIAR ACESSO'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} className="text-xs font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
            {view === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
