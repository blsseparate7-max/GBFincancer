
import React, { useState } from 'react';
import { db, auth } from '../services/firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { UserSession } from '../types';

interface AuthProps {
  onLogin: (session: UserSession) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Configura persistência local antes do login
      await setPersistence(auth, browserLocalPersistence);
      
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userRef = doc(db, "users", userCred.user.uid);
      const finalDoc = await getDoc(userRef);
      const userData = finalDoc.data();

      onLogin({
        uid: userCred.user.uid,
        userId: userData?.userId || email,
        name: userData?.name || "Usuário",
        email: userData?.email || email,
        isLoggedIn: true,
        role: (userData?.role as 'USER' | 'ADMIN') || 'USER',
        subscriptionStatus: userData?.subscriptionStatus || 'ACTIVE'
      });
    } catch (err: any) {
      console.error(err);
      let friendlyError = "Erro ao entrar. Verifique suas credenciais.";
      if (err.code === "auth/user-not-found") friendlyError = "Usuário não encontrado.";
      if (err.code === "auth/wrong-password") friendlyError = "Senha incorreta.";
      if (err.code === "auth/invalid-email") friendlyError = "E-mail inválido.";
      setError(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPass) {
      setError("As senhas não coincidem.");
      setIsLoading(false);
      return;
    }

    try {
      const userIdLower = id.toLowerCase().trim();
      const usernameRef = doc(db, "usernames", userIdLower);
      const usernameSnap = await getDoc(usernameRef);
      
      if (usernameSnap.exists()) {
        throw new Error("Este ID já está em uso.");
      }

      // Configura persistência local antes do cadastro
      await setPersistence(auth, browserLocalPersistence);
      
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      const userData = {
        uid: userCred.user.uid,
        userId: userIdLower,
        name: name.trim(),
        email: email.trim(),
        role: 'USER' as const,
        subscriptionStatus: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        status: 'active' as const,
        onboardingSeen: false
      };

      await setDoc(doc(db, "users", userCred.user.uid), userData);
      await setDoc(usernameRef, { uid: userCred.user.uid });

      onLogin({
        ...userData,
        isLoggedIn: true
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("Link de recuperação enviado para seu e-mail.");
    } catch (err: any) {
      setError("Erro ao enviar e-mail. Verifique o endereço digitado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#0B141A] relative overflow-hidden">
      <div className="absolute inset-0 whatsapp-pattern opacity-[0.03] pointer-events-none"></div>

      <div className="w-full max-w-[420px] relative z-10 animate-fade">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#00A884] rounded-[2.2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#00A884]/20 text-white text-4xl font-black italic transform -rotate-3 border-4 border-white/10">
            GB
          </div>
          <h1 className="text-3xl font-black text-[#E9EDEF] uppercase tracking-tighter">GBFinancer</h1>
          <p className="text-[11px] font-bold text-[#8696A0] uppercase tracking-[0.3em] mt-1.5 opacity-80">
            Inteligência Financeira Premium
          </p>
        </div>

        <div className="bg-[#111B21] p-8 rounded-[2.5rem] shadow-2xl border border-[#2A3942]/60 backdrop-blur-sm">
          <header className="mb-8">
            <h2 className="text-2xl font-black text-[#E9EDEF] tracking-tight">
              {view === 'login' ? 'Entrar' : view === 'signup' ? 'Criar Conta' : 'Recuperar'}
            </h2>
            <p className="text-sm text-[#8696A0] font-medium mt-1">
              {view === 'login' 
                ? 'Acesse sua conta para acompanhar sua vida financeira.' 
                : view === 'signup' 
                ? 'Comece sua jornada rumo à liberdade financeira hoje.' 
                : 'Informe seu e-mail para receber as instruções de acesso.'}
            </p>
          </header>

          <form 
            onSubmit={view === 'login' ? handleLogin : view === 'signup' ? handleSignup : handleForgot} 
            className="space-y-4"
          >
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-2xl animate-fade flex items-center gap-3">
                <span className="text-lg">⚠️</span> {error}
              </div>
            )}
            
            {message && (
              <div className="p-4 bg-[#00A884]/10 border border-[#00A884]/20 text-[#00A884] text-xs font-bold rounded-2xl animate-fade flex items-center gap-3">
                <span className="text-lg">✅</span> {message}
              </div>
            )}

            {view === 'signup' && (
              <>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696A0] group-focus-within:text-[#00A884] transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </span>
                  <input 
                    className="w-full bg-[#202C33] text-[#E9EDEF] rounded-2xl pl-12 pr-4 py-4 text-sm font-medium outline-none border border-transparent focus:border-[#00A884] transition-all placeholder-[#8696A0]/50" 
                    placeholder="Seu Nome Completo" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696A0] group-focus-within:text-[#00A884] transition-colors text-xs font-black italic">ID</span>
                  <input 
                    className="w-full bg-[#202C33] text-[#E9EDEF] rounded-2xl pl-12 pr-4 py-4 text-sm font-medium outline-none border border-transparent focus:border-[#00A884] transition-all placeholder-[#8696A0]/50" 
                    placeholder="Identificador Único (ex: vicentin)" 
                    value={id} 
                    onChange={e => setId(e.target.value)} 
                    required 
                  />
                </div>
              </>
            )}

            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696A0] group-focus-within:text-[#00A884] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </span>
              <input 
                type="email"
                className="w-full bg-[#202C33] text-[#E9EDEF] rounded-2xl pl-12 pr-4 py-4 text-sm font-medium outline-none border border-transparent focus:border-[#00A884] transition-all placeholder-[#8696A0]/50" 
                placeholder="Endereço de E-mail" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>

            {view !== 'forgot' && (
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696A0] group-focus-within:text-[#00A884] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span>
                <input 
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-[#202C33] text-[#E9EDEF] rounded-2xl pl-12 pr-12 py-4 text-sm font-medium outline-none border border-transparent focus:border-[#00A884] transition-all placeholder-[#8696A0]/50" 
                  placeholder="Sua Senha" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  minLength={6}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                  )}
                </button>
              </div>
            )}

            {view === 'signup' && (
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696A0] group-focus-within:text-[#00A884] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </span>
                <input 
                  type="password"
                  className="w-full bg-[#202C33] text-[#E9EDEF] rounded-2xl pl-12 pr-4 py-4 text-sm font-medium outline-none border border-transparent focus:border-[#00A884] transition-all placeholder-[#8696A0]/50" 
                  placeholder="Confirme sua Senha" 
                  value={confirmPass} 
                  onChange={e => setConfirmPass(e.target.value)} 
                  required 
                />
              </div>
            )}

            {view === 'login' && (
              <div className="text-right">
                <button 
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-xs font-bold text-[#00A884] hover:text-[#00C99D] transition-colors uppercase tracking-widest"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#00A884] text-white font-black py-4 rounded-2xl text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-[#00A884]/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                view === 'login' ? 'Entrar Agora' : view === 'signup' ? 'Cadastrar Minha Conta' : 'Enviar Link'
              )}
            </button>
          </form>

          <footer className="mt-8 pt-6 border-t border-[#2A3942]/40 text-center">
            <button 
              onClick={() => {
                setView(view === 'login' ? 'signup' : 'login');
                setError(null);
                setMessage(null);
              }}
              className="text-xs font-bold text-[#8696A0] hover:text-[#E9EDEF] transition-all"
            >
              {view === 'login' ? (
                <>Não tem uma conta? <span className="text-[#00A884]">Criar conta</span></>
              ) : (
                <>Já possui uma conta? <span className="text-[#00A884]">Fazer login</span></>
              )}
            </button>
          </footer>
        </div>

        <div className="mt-8 text-center flex items-center justify-center gap-2 opacity-40">
          <svg className="w-4 h-4 text-[#8696A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <p className="text-[10px] font-black text-[#8696A0] uppercase tracking-[0.2em]">Seus dados ficam protegidos.</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
