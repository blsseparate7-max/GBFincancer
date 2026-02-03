
import React, { useState } from 'react';
import { UserSession, CustomerData } from '../types';
import { fetchUserData, syncUserData } from '../services/databaseService';

interface AuthProps {
  onLogin: (session: UserSession) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const loginId = email.trim().toLowerCase();

    try {
      if (view === 'login') {
        // Admin Bypass
        if (loginId === 'vicente' && password === 'gbfinancer') {
           onLogin({ id: 'admin', name: 'Vicente', isLoggedIn: true, plan: 'YEARLY', subscriptionStatus: 'ACTIVE', role: 'ADMIN' });
           return;
        }

        const data = await fetchUserData(loginId);
        if (data && data.password === password) {
          onLogin({ id: loginId, name: data.userName, isLoggedIn: true, plan: data.plan, subscriptionStatus: data.subscriptionStatus, role: 'USER' });
        } else {
          setError("Credenciais inválidas.");
        }
      } else {
        const initialData: CustomerData = {
          userId: loginId,
          userName: name,
          password: password,
          plan: 'YEARLY',
          subscriptionStatus: 'ACTIVE',
          transactions: [],
          goals: [],
          messages: [],
          bills: [],
          notes: [],
          lastActive: new Date().toISOString()
        };
        await syncUserData(loginId, initialData);
        onLogin({ id: loginId, name: name, isLoggedIn: true, plan: 'YEARLY', subscriptionStatus: 'ACTIVE', role: 'USER' });
      }
    } catch (err) {
      setError("Erro ao processar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-viewport w-full flex flex-col items-center justify-center bg-[#075e54] p-6 relative overflow-hidden">
      <div className="whatsapp-pattern"></div>
      
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center mb-8 border-b-8 border-black/20">
          <span className="text-5xl font-black text-[#075e54] italic tracking-tighter">$</span>
        </div>
        
        <div className="bg-white w-full rounded-[3rem] p-8 shadow-2xl border-b-8 border-black/10">
          <h2 className="text-3xl font-black italic tracking-tighter text-slate-900 mb-2 text-center">GBFinancer</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 text-center">Gestão Inteligente</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-rose-600 text-white text-[10px] p-3 rounded-xl font-black text-center uppercase animate-pulse">{error}</div>}
            
            {view === 'signup' && (
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none" placeholder="Seu Nome"
              />
            )}
            
            <input 
              type="text" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none" placeholder="Usuário ou E-mail"
            />
            
            <input 
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none" placeholder="Sua Senha"
            />
            
            <button type="submit" disabled={isLoading} className="w-full btn-primary py-5 rounded-2xl mt-4 text-sm">
              {isLoading ? 'Aguarde...' : (view === 'login' ? 'Entrar Agora' : 'Criar minha Conta')}
            </button>
          </form>

          <button 
            onClick={() => setView(view === 'login' ? 'signup' : 'login')}
            className="w-full mt-8 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-[#075e54] transition-colors"
          >
            {view === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-8 text-[8px] font-black uppercase tracking-[0.4em] text-white/30 italic">Build v2.0.1 • Estabilidade Total</div>
    </div>
  );
};

export default Auth;
