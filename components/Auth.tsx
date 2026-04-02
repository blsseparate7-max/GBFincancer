
import React, { useState } from 'react';
import { db, auth, isFirebaseConfigured } from '../services/firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { UserSession } from '../types';
import LegalModal from './LegalModal';
import { TRIAL_DAYS } from '../constants';

interface AuthProps {
  onLogin: (session: UserSession) => void;
  onOpenSupport: () => void;
  initialView?: 'login' | 'signup' | 'forgot';
}

const Auth: React.FC<AuthProps> = ({ onLogin, onOpenSupport, initialView = 'login' }) => {
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>(initialView);
  
  if (!isFirebaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B141A] p-4 font-sans">
        <div className="max-w-md w-full bg-[#111B21] rounded-2xl shadow-2xl p-8 text-center border border-[#2A3942]">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#E9EDEF] mb-3">Configuração Necessária</h2>
          <p className="text-[#8696A0] mb-8 text-sm leading-relaxed">
            O Firebase não está configurado. Por favor, adicione as chaves da API no arquivo <code className="bg-[#202C33] px-1.5 py-0.5 rounded text-[#00A884]">firebase-applet-config.json</code> para habilitar o login.
          </p>
          <div className="text-xs text-[#8696A0] bg-[#202C33] p-4 rounded-xl text-left border border-[#2A3942]">
            <p className="font-bold text-[#E9EDEF] mb-2 uppercase tracking-wider">Passos para corrigir:</p>
            <ul className="space-y-2">
              <li className="flex gap-2"><span className="text-[#00A884]">1.</span> Acesse o Firebase Console</li>
              <li className="flex gap-2"><span className="text-[#00A884]">2.</span> Crie um projeto ou use um existente</li>
              <li className="flex gap-2"><span className="text-[#00A884]">3.</span> Adicione um App Web e copie as chaves</li>
              <li className="flex gap-2"><span className="text-[#00A884]">4.</span> Cole no arquivo de configuração</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [name, setName] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [legalView, setLegalView] = useState<'terms' | 'privacy' | 'none'>('none');

  // Configurar persistência uma única vez ao montar o componente
  React.useEffect(() => {
    const initAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (err) {
        console.error("Erro ao configurar persistência:", err);
      }
    };
    initAuth();
  }, []);

  // Capturar resultado de redirecionamento (fallback do Google Login)
  React.useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("GB: Login via redirecionamento detectado. UID:", result.user.uid);
          setIsLoading(true);
          await handlePostAuth(result.user);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("GB: Erro no resultado do redirecionamento:", err);
        setError("Erro ao processar o login com Google via redirecionamento.");
      }
    };
    handleRedirect();
  }, []);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error.message || String(error),
      code: error.code,
      operation,
      path,
      auth: {
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified
      }
    };
    console.error(`GB: Erro Firestore (${operation}) em ${path}:`, JSON.stringify(errInfo, null, 2));
    return error;
  };

  const handlePostAuth = async (user: any) => {
    if (!user || !user.uid) {
      console.error("GB: User ou UID inválido no handlePostAuth");
      return;
    }

    console.log("GB: Iniciando handlePostAuth para UID:", user.uid);
    
    // Pequeno delay para garantir que o SDK do Firebase Auth tenha propagado o estado
    // Isso é crucial para que as Security Rules do Firestore funcionem corretamente
    if (!auth.currentUser) {
      console.warn("GB: auth.currentUser está nulo no início do handlePostAuth! Aguardando sincronização...");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      const userRef = doc(db, "users", user.uid);
      console.log("GB: Tentando acessar Firestore para o usuário:", user.uid);
      
      let userDoc;
      try {
        userDoc = await getDoc(userRef);
      } catch (err: any) {
        // Se falhar por permissão, pode ser que o token ainda não tenha sido propagado
        if (err.code === 'permission-denied') {
          console.warn("GB: Permissão negada inicial. Tentando novamente em 1.5s...");
          await new Promise(resolve => setTimeout(resolve, 1500));
          userDoc = await getDoc(userRef);
        } else {
          throw handleFirestoreError(err, "GET", userRef.path);
        }
      }
      
      const now = new Date();
      
      if (!userDoc.exists()) {
        console.log("GB: Novo usuário detectado. Criando documento...");
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

        const userData = {
          uid: user.uid,
          userId: user.email?.split('@')[0] || user.uid.substring(0, 8),
          name: user.displayName || "Usuário",
          email: user.email || "",
          photoURL: user.photoURL || null,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          trialEndsAt: trialEndsAt.toISOString(),
          subscriptionStatus: "trial" as const,
          subscriptionEndsAt: null,
          plan: "free",
          paymentProvider: null,
          role: (user.email?.toLowerCase() === 'gbfinancer@gmail.com' || user.email?.toLowerCase() === 'blsseparate7@gmail.com') ? 'admin' as const : 'user' as const,
          status: 'active' as const,
          onboardingSeen: false,
          lgpdAccepted: false
        };

        console.log("GB: Tentando setDoc (create)...");
        try {
          await setDoc(userRef, userData);
          console.log("GB: Documento criado com sucesso.");
        } catch (err) {
          throw handleFirestoreError(err, "CREATE", userRef.path);
        }
        onLogin({ ...userData, isLoggedIn: true });
      } else {
        console.log("GB: Usuário já existe. Atualizando dados básicos...");
        const existingData = userDoc.data();
        
        // Atualiza apenas campos básicos para manter consistência (nome, foto, último login)
        const updateData = {
          lastLogin: serverTimestamp(),
          name: existingData?.name || user.displayName || "Usuário",
          photoURL: existingData?.photoURL || user.photoURL || null,
          userId: existingData?.userId || user.email?.split('@')[0] || user.uid.substring(0, 8),
          email: existingData?.email || user.email || "",
          status: 'active' as const, // Garante que a conta seja reativada se estiver como 'deleted'
        };
        
        console.log("GB: Tentando setDoc (update merge)...");
        try {
          await setDoc(userRef, updateData, { merge: true });
          console.log("GB: Dados atualizados com sucesso.");
        } catch (err) {
          throw handleFirestoreError(err, "UPDATE", userRef.path);
        }
        
        onLogin({
          uid: user.uid,
          userId: existingData?.userId || user.email,
          name: existingData?.name || user.displayName || "Usuário",
          email: existingData?.email || user.email || "",
          photoURL: existingData?.photoURL || user.photoURL || null,
          isLoggedIn: true,
          role: (user.email?.toLowerCase() === 'gbfinancer@gmail.com' || user.email?.toLowerCase() === 'blsseparate7@gmail.com') ? 'admin' : ((existingData?.role as 'user' | 'admin') || 'user'),
          subscriptionStatus: existingData?.subscriptionStatus || 'inactive',
          plan: existingData?.plan,
          trialEndsAt: existingData?.trialEndsAt,
          subscriptionEndsAt: existingData?.subscriptionEndsAt,
          paymentProvider: existingData?.paymentProvider,
          onboardingSeen: existingData?.onboardingSeen,
          lgpdAccepted: existingData?.lgpdAccepted,
          status: 'active' as const
        });
      }
    } catch (err: any) {
      console.error("GB: Erro detalhado no handlePostAuth:", err);
      if (err.code) console.error("GB: Código do erro:", err.code);
      setError("Erro ao sincronizar seus dados. Tente novamente.");
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setMessage(null);
    setIsLoading(true);
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      console.log("GB: Iniciando login com Google (Popup)...");
      const result = await signInWithPopup(auth, provider);
      console.log("GB: Popup concluído com sucesso. UID:", result.user.uid);
      await handlePostAuth(result.user);
    } catch (err: any) {
      console.error("GB: Erro no Google Login:", err);
      
      if (err.code === "auth/popup-blocked") {
        console.log("GB: Popup bloqueado. Tentando redirecionamento...");
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirErr: any) {
          console.error("GB: Erro no redirecionamento:", redirErr);
          setError("O popup foi bloqueado e o redirecionamento falhou. Verifique as permissões do navegador.");
          setIsLoading(false);
        }
      } else if (err.code === "auth/popup-closed-by-user") {
        setError("Login cancelado pelo usuário.");
        setIsLoading(false);
      } else if (err.code === "auth/unauthorized-domain") {
        setError("Este domínio não está autorizado no Firebase Console. Adicione o domínio da Vercel em Authentication > Settings > Authorized domains.");
        setIsLoading(false);
      } else {
        setError(`Erro ao entrar com Google: ${err.message || 'Tente novamente.'}`);
        setIsLoading(false);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      console.log("GB: Iniciando tentativa de login para:", email.trim());
      
      // Garante que a persistência está configurada como LOCAL
      await setPersistence(auth, browserLocalPersistence);
      console.log("GB: Persistência configurada com sucesso.");
      
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log("GB: Auth bem-sucedido. UID:", userCred.user.uid);

      const userRef = doc(db, "users", userCred.user.uid);
      let finalDoc;
      try {
        finalDoc = await getDoc(userRef);
      } catch (err) {
        throw handleFirestoreError(err, "GET", userRef.path);
      }
      
      if (!finalDoc.exists()) {
        console.warn("GB: Usuário autenticado no Auth, mas documento não encontrado no Firestore.");
        // Fallback: Se o usuário existe no Auth mas não no Firestore (comum em migrações/erros de cadastro)
        // Vamos criar um perfil básico para não quebrar o sistema
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
        
        const basicData = {
          uid: userCred.user.uid,
          userId: email.trim().split('@')[0],
          name: "Usuário Recuperado",
          email: email.trim(),
          role: 'user' as const,
          subscriptionStatus: 'trial' as const,
          trialEndsAt: trialEndsAt.toISOString(),
          createdAt: new Date().toISOString(),
          status: 'active' as const,
          onboardingSeen: true
        };
        
        try {
          await setDoc(userRef, basicData);
          console.log("GB: Perfil de fallback criado no Firestore.");
        } catch (err) {
          throw handleFirestoreError(err, "CREATE", userRef.path);
        }
        onLogin({ ...basicData, isLoggedIn: true });
        return;
      }

      const userData = finalDoc.data();
      console.log("GB: Dados do Firestore recuperados com sucesso.");

      onLogin({
        uid: userCred.user.uid,
        userId: userData?.userId || email,
        name: userData?.name || "Usuário",
        email: userData?.email || email,
        isLoggedIn: true,
        role: (email.trim().toLowerCase() === 'gbfinancer@gmail.com' || email.trim().toLowerCase() === 'blsseparate7@gmail.com') ? 'admin' : ((userData?.role as 'user' | 'admin') || 'user'),
        subscriptionStatus: userData?.subscriptionStatus || 'inactive',
        plan: userData?.plan,
        trialEndsAt: userData?.trialEndsAt,
        subscriptionEndsAt: userData?.subscriptionEndsAt,
        paymentProvider: userData?.paymentProvider
      });
    } catch (err: any) {
      console.error("GB: Erro detalhado no Login:", {
        code: err.code,
        message: err.message,
        email: email.trim()
      });
      let friendlyError = "Erro ao entrar. Verifique suas credenciais.";
      
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        friendlyError = "E-mail ou senha incorretos. Se você acabou de criar a conta em um novo projeto, certifique-se de usar as novas credenciais.";
      } else if (err.code === "auth/invalid-email") {
        friendlyError = "E-mail inválido.";
      } else if (err.code === "auth/too-many-requests") {
        friendlyError = "Muitas tentativas. Tente novamente mais tarde.";
      }
      
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
      // Configura persistência local antes do cadastro
      await setPersistence(auth, browserLocalPersistence);
      
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

      const userData = {
        uid: userCred.user.uid,
        userId: email.trim().split('@')[0],
        name: name.trim(),
        email: email.trim(),
        role: 'user' as const,
        subscriptionStatus: 'trial' as const,
        trialEndsAt: trialEndsAt.toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active' as const,
        onboardingSeen: false
      };

      try {
        await setDoc(doc(db, "users", userCred.user.uid), userData);
      } catch (err) {
        throw handleFirestoreError(err, "CREATE", `users/${userCred.user.uid}`);
      }

      onLogin({
        ...userData,
        isLoggedIn: true
      });
    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      let friendlyError = "Erro ao criar conta. Tente novamente.";
      
      if (err.code === "auth/email-already-in-use") {
        friendlyError = "Este e-mail já está em uso. Se você já tem uma conta, tente entrar em vez de criar uma nova.";
      } else if (err.code === "auth/weak-password") {
        friendlyError = "A senha deve ter pelo menos 6 caracteres.";
      } else if (err.code === "auth/invalid-email") {
        friendlyError = "E-mail inválido.";
      } else if (err.code === "auth/invalid-credential") {
        friendlyError = "Erro de credenciais. Tente novamente ou use outro e-mail.";
      } else if (err.code === "auth/operation-not-allowed") {
        friendlyError = "O cadastro com e-mail e senha não está habilitado. Entre em contato com o suporte.";
      }
      
      setError(friendlyError);
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
    <div className="min-h-dvh w-full flex flex-col items-center justify-center p-6 bg-[#0B141A] relative overflow-y-auto py-12">
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

            {view === 'forgot' ? (
              <div className="text-right">
                <button 
                  type="button"
                  onClick={() => setView('login')}
                  className="text-xs font-bold text-[#00A884] hover:text-[#00C99D] transition-colors uppercase tracking-widest"
                >
                  Voltar para o login
                </button>
              </div>
            ) : (
              view === 'login' && (
                <div className="text-right">
                  <button 
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-xs font-bold text-[#00A884] hover:text-[#00C99D] transition-colors uppercase tracking-widest"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#00A884] text-white font-black py-4 rounded-2xl text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-[#00A884]/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                view === 'login' ? 'Entrar Agora' : view === 'signup' ? 'Começar teste grátis' : 'Enviar Link'
              )}
            </button>

            {view !== 'forgot' && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#2A3942]/40"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em]">
                    <span className="px-4 bg-[#111B21] text-[#8696A0]">Ou continue com</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full bg-white text-[#111B21] font-black py-4 rounded-2xl text-[12px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </button>
              </>
            )}
          </form>

          <footer className="mt-8 pt-6 border-t border-[#2A3942]/40 text-center">
            <button 
              type="button"
              onClick={() => {
                if (view === 'forgot') {
                  setView('login');
                } else {
                  setView(view === 'login' ? 'signup' : 'login');
                }
                setError(null);
                setMessage(null);
              }}
              className="text-xs font-bold text-[#8696A0] hover:text-[#E9EDEF] transition-all"
            >
              {view === 'login' ? (
                <>Não tem uma conta? <span className="text-[#00A884]">Começar teste grátis</span></>
              ) : view === 'signup' ? (
                <>Já possui uma conta? <span className="text-[#00A884]">Já comprei? Entrar</span></>
              ) : (
                <>Lembrou a senha? <span className="text-[#00A884]">Voltar para login</span></>
              )}
            </button>
          </footer>
        </div>

        <div className="mt-8 text-center flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2 opacity-40">
            <svg className="w-4 h-4 text-[#8696A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <p className="text-[10px] font-black text-[#8696A0] uppercase tracking-[0.2em]">Seus dados ficam protegidos.</p>
          </div>
          
          <div className="flex items-center gap-3 text-[9px] font-black text-[#8696A0]/40 uppercase tracking-widest">
            <button onClick={() => setLegalView('terms')} className="hover:text-[#00A884] transition-colors">Termos de Uso</button>
            <span className="opacity-20">|</span>
            <button onClick={() => setLegalView('privacy')} className="hover:text-[#00A884] transition-colors">Política de Privacidade</button>
            <span className="opacity-20">|</span>
            <button onClick={onOpenSupport} className="text-[#00A884] hover:text-[#00C99D] transition-colors">Suporte</button>
          </div>
        </div>
      </div>

      <LegalModal type={legalView} onClose={() => setLegalView('none')} />
    </div>
  );
};

export default Auth;
