
import React, { useState } from 'react';
import { db, auth } from '../services/firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { UserSession } from '../types';

interface AuthProps {
  onLogin: (session: UserSession) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [idOrEmail, setIdOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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
      let loginEmail = idOrEmail.trim();

      if (!loginEmail.includes('@')) {
        const usernameId = loginEmail.toLowerCase();
        const usernameRef = doc(db, "usernames", usernameId);
        const usernameSnap = await getDoc(usernameRef);
        
        if (!usernameSnap.exists()) {
          throw new Error(`ID "${loginEmail}" não encontrado.`);
        }

        const userUid = usernameSnap.data().uid;
        const userDoc = await getDoc(doc(db, "users", userUid));
        
        if (!userDoc.exists() || !userDoc.data()?.email) {
          throw new Error("Erro de integridade do ID.");
        }
        
        loginEmail = userDoc.data().email;
      }

      const userCred = await signInWithEmailAndPassword(auth, loginEmail, password);
      const userRef = doc(db, "users", userCred.user.uid);
      const finalDoc = await getDoc(userRef);
      const userData = finalDoc.data();

      // Forçar role ADMIN se for Vicentin no login
      let currentRole = userData?.role || 'USER';
      if (userData?.userId?.toLowerCase() === 'vicentin') {
        currentRole = 'ADMIN';
        await updateDoc(userRef, { role: 'ADMIN' });
      }

      onLogin({
        uid: userCred.user.uid,
        userId: userData?.userId || idOrEmail,
        name: userData?.name || "Usuário",
        email: userData?.email || loginEmail,
        isLoggedIn: true,
        role: currentRole as 'USER' | 'ADMIN',
        subscriptionStatus: userData?.subscriptionStatus || 'ACTIVE'
      });
    } catch (err: any) {
      if (err.code === "auth/configuration-not-found") {
        setError("Ative E-mail/Senha no Firebase Authentication.");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPass) {
      setError("Senhas não coincidem.");
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

      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      // Lógica especial para o Vicentin
      // Adicionando tipagem explícita para evitar erro de string vs union type no UserSession
      const userRole: 'USER' | 'ADMIN' = userIdLower === 'vicentin' ? 'ADMIN' : 'USER';

      const userData = {
        uid: userCred.user.uid,
        userId: userIdLower,
        name: name.trim(),
        email: email.trim(),
        role: userRole,
        subscriptionStatus: 'ACTIVE' as const,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", userCred.user.uid), userData);
      await setDoc(usernameRef, { uid: userCred.user.uid });

      // Fix para o erro de atribuição no onLogin
      onLogin({
        uid: userData.uid,
        userId: userData.userId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        subscriptionStatus: userData.subscriptionStatus,
        isLoggedIn: true
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-[#f0f2f5]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-4 shadow-md text-white text-3xl font-black italic">GB</div>
          <h1 className="text-2xl font-black text-[#111b21] uppercase tracking-tighter">GBFinancer</h1>
          <p className="text-[10px] font-bold text-[#667781] uppercase tracking-[0.3em] mt-1 italic">Inteligência Financeira</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-[#d1d7db]">
          <h2 className="text-lg font-bold text-[#111b21] mb-6 text-center">
            {view === 'login' ? 'Acessar Conta' : view === 'signup' ? 'Novo Cadastro' : 'Recuperar'}
          </h2>
          
          <form onSubmit={view === 'login' ? handleLogin : handleSignup} className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-500 text-[11px] font-bold rounded-lg border border-red-100">{error}</div>}
            
            {view === 'login' ? (
              <>
                <input className="w-full bg-[#f0f2f5] rounded-lg px-4 py-3.5 text-sm outline-none border border-transparent focus:border-[#00a884]" placeholder="ID (ex: Vicentin) ou E-mail" value={idOrEmail} onChange={e => setIdOrEmail(e.target.value)} required />
                <input type="password" className="w-full bg-[#f0f2f5] rounded-lg px-4 py-3.5 text-sm outline-none border border-transparent focus:border-[#00a884]" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required />
              </>
            ) : (
              <>
                <input className="w-full bg-[#f0f2f5] rounded-lg px-4 py-3.5 text-sm outline-none border border-[#d1d7db]" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} required />
                <input className="w-full bg-[#f0f2f5] rounded-lg px-4 py-3.5 text-sm outline-none border border-[#d1d7db]" placeholder="ID (ex: vicentin)" value={id} onChange={e => setId(e.target.value)} required />
                <input className="w-full bg-[#f0f2f5] rounded-lg px-4 py-3.5 text-sm outline-none border border-[#d1d7db]" placeholder="Seu E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
                <input type="password" className="w-full bg-[#f0f2f5] rounded-lg px-4 py-3.5 text-sm outline-none border border-[#d1d7db]" placeholder="Sua Senha" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                <input type="password" className="w-full bg-[#f0f2f5] rounded-lg px-4 py-3.5 text-sm outline-none border border-[#d1d7db]" placeholder="Confirme a Senha" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
              </>
            )}

            <button 
              disabled={isLoading}
              className="w-full bg-[#00a884] text-white font-bold py-3.5 rounded-lg text-sm uppercase tracking-widest shadow-md active:scale-95 transition-all mt-4 disabled:opacity-50"
            >
              {isLoading ? 'Aguarde...' : (view === 'login' ? 'Entrar' : 'Cadastrar')}
            </button>
          </form>

          <button 
            onClick={() => setView(view === 'login' ? 'signup' : 'login')}
            className="w-full text-[11px] font-bold text-[#008069] mt-6 uppercase tracking-wider"
          >
            {view === 'login' ? 'Não tem conta? Clique aqui' : 'Já tem conta? Faça Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
