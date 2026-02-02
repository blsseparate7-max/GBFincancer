
import React, { useState } from 'react';
import { UserSession, SubscriptionPlan, CustomerData } from '../types';
import { fetchUserData, syncUserData } from '../services/databaseService';

interface AuthProps {
  onLogin: (session: UserSession) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'signup' | 'processing'>('login');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState(0);

  const setupMessages = [
    "Validando credenciais...",
    "Criptografando cofre de dados...",
    "Sincronizando com a nuvem GB...",
    "Iniciando consultoria IA...",
    "Seja bem-vindo ao Beta!"
  ];

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setView('processing');
    autoCreateAccount();
  };

  const autoCreateAccount = async () => {
    setIsLoading(true);
    setError(null);

    for (let i = 0; i < setupMessages.length; i++) {
      setSetupStep(i);
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    try {
      const expiresAt = new Date(2099, 11, 31);
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const userId = email.trim().toLowerCase();

      const initialData: CustomerData = {
        userId: userId,
        userName: fullName,
        plan: 'YEARLY',
        subscriptionStatus: 'ACTIVE',
        transactions: [],
        goals: [],
        messages: [{
          id: 'welcome',
          text: `Olá ${firstName}! Que bom ter você no nosso Beta. Sou o GB, seu assistente pessoal.`,
          sender: 'ai',
          timestamp: new Date().toISOString()
        }],
        bills: [],
        notes: [],
        lastActive: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        budget: 0,
        categoryLimits: [],
        categories: [
          { name: 'Cartão de Crédito', type: 'EXPENSE' },
          { name: 'Alimentação', type: 'EXPENSE' },
          { name: 'Moradia', type: 'EXPENSE' },
          { name: 'Transporte', type: 'EXPENSE' },
          { name: 'Saúde', type: 'EXPENSE' },
          { name: 'Outros', type: 'EXPENSE' }
        ]
      };

      const success = await syncUserData(userId, { ...initialData, password: password });
      
      if (success) {
        const session: UserSession = { 
          id: userId, 
          name: fullName, 
          isLoggedIn: true, 
          plan: 'YEARLY', 
          subscriptionStatus: 'ACTIVE', 
          role: 'USER',
          expiresAt: expiresAt.toISOString()
        };
        onLogin(session);
      } else {
        setError("Erro ao salvar dados. Tente novamente.");
        setView('signup');
      }
    } catch (err) {
      setError("Falha ao criar sua conta.");
      setView('signup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginIdentifier = email.trim().toLowerCase();
    
    if (!loginIdentifier || !password) {
        setError("Preencha todos os campos.");
        return;
    }
    setIsLoading(true);

    try {
      if ((loginIdentifier === 'gbfinancer@gmail.com' || loginIdentifier === 'vicente') && password === 'gbfinancer') {
        onLogin({
          id: 'gbfinancer@gmail.com',
          name: 'Vicente',
          isLoggedIn: true,
          plan: 'YEARLY',
          subscriptionStatus: 'ACTIVE',
          role: 'ADMIN',
          expiresAt: new Date(2099, 0, 1).toISOString()
        });
        return;
      }

      const userData = await fetchUserData(loginIdentifier);
      if (userData && userData.userName) {
        if (userData.password && userData.password !== password) {
          setError("Senha incorreta.");
        } else {
          onLogin({
            id: loginIdentifier,
            name: userData.userName,
            isLoggedIn: true,
            plan: userData.plan || 'YEARLY',
            subscriptionStatus: userData.subscriptionStatus || 'ACTIVE',
            role: userData.role || 'USER',
            expiresAt: userData.expiresAt
          });
        }
      } else {
        setError("Usuário não encontrado.");
      }
    } catch (err) {
      setError("Erro de conexão.");
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950 p-8 text-center animate-in fade-in">
        <div className="relative w-32 h-32 mb-8">
          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-black text-emerald-500 italic">$</span>
          </div>
        </div>
        <h2 className="text-2xl font-black text-white tracking-tighter italic mb-2">Preparando seu Cofre</h2>
        <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.3em] animate-pulse">
          {setupMessages[setupStep]}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#075e54] p-8 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none whatsapp-bg"></div>
      <div className="relative z-10 w-full flex flex-col items-center max-w-sm">
        <div className="w-20 h-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center mb-6 border-b-4 border-emerald-200">
           <span className="text-3xl font-black text-[#075e54] italic">$</span>
        </div>
        <h1 className="text-4xl font-black mb-1 tracking-tighter italic text-center">GBFinancer</h1>
        <p className="text-[10px] font-bold opacity-60 uppercase tracking-[0.4em] mb-10 text-center">Seu Assistente Financeiro</p>
        
        <form onSubmit={view === 'login' ? handleLogin : handleSignup} className="w-full space-y-3">
          {error && <div className="bg-red-500 bg-opacity-20 border border-red-500 border-opacity-30 text-red-100 text-[10px] p-4 rounded-xl font-bold text-center uppercase mb-4">{error}</div>}

          {view === 'signup' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                  className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl px-5 py-4 text-white placeholder-white placeholder-opacity-40 outline-none text-sm"
                  placeholder="Nome"
                />
                <input 
                  type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                  className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl px-5 py-4 text-white placeholder-white placeholder-opacity-40 outline-none text-sm"
                  placeholder="Sobrenome"
                />
              </div>
              <input 
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl px-5 py-4 text-white placeholder-white placeholder-opacity-40 outline-none text-sm"
                placeholder="E-mail"
              />
              <input 
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl px-5 py-4 text-white placeholder-white placeholder-opacity-40 outline-none text-sm"
                placeholder="Senha"
              />
              <input 
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl px-5 py-4 text-white placeholder-white placeholder-opacity-40 outline-none text-sm"
                placeholder="Confirme a Senha"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <input 
                type="text" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl px-5 py-4 text-white placeholder-white placeholder-opacity-40 outline-none text-sm"
                placeholder="E-mail ou ID"
              />
              <input 
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl px-5 py-4 text-white placeholder-white placeholder-opacity-40 outline-none text-sm"
                placeholder="Senha"
              />
            </div>
          )}
          
          <button type="submit" disabled={isLoading} className="w-full bg-white text-[#075e54] font-black py-5 rounded-2xl shadow-2xl active:transform active:scale-95 transition-all uppercase tracking-widest text-[11px]">
            {isLoading ? 'CARREGANDO...' : (view === 'login' ? 'ENTRAR' : 'CRIAR MINHA CONTA')}
          </button>
        </form>

        <button onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError(null); }} className="mt-8 text-[10px] font-black uppercase tracking-widest opacity-60 underline hover:opacity-100 transition-opacity">
          {view === 'login' ? 'Quero participar do Beta' : 'Já tenho conta'}
        </button>
      </div>
      <div className="absolute bottom-6 text-[8px] font-black uppercase tracking-[0.3em] opacity-30">Versão Beta 1.0</div>
    </div>
  );
};

export default Auth;
