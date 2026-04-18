import React, { useState, useEffect } from 'react';
import { db, auth, clearIndexedDbPersistence } from './services/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, orderBy, limit, getDoc, where } from 'firebase/firestore';
import { UserSession, Transaction, SavingGoal, Notification, Message, Bill, CategoryLimit, CreditCardInfo, Wallet, UserCategory, UserOnboarding, Debt, CategoryPattern } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Auth from './components/Auth';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import CalendarTab from './components/CalendarTab';
import Goals from './components/Goals';
import CreditCard from './components/CreditCard';
import Reminders from './components/Reminders';
import Messages from './components/Messages';
import ProfileEdit from './components/ProfileEdit';
import AdminPanel from './components/AdminPanel';
import SetupWizard from './components/SetupWizard';
import GuidedOnboarding from './components/GuidedOnboarding';
import WelcomeOnboarding from './components/WelcomeOnboarding';
import LGPDOnboarding from './components/LGPDOnboarding';
import { saveWizardPhase1, finalizeOnboarding } from './services/onboardingService';
import ImpactSimulator from './components/ImpactSimulator';
import YearlySummary from './components/YearlySummary';
import Settings from './components/Settings';
import WalletTab from './components/WalletTab';
import Insights from './components/Insights';
import HealthScoreTab from './components/HealthScoreTab';
import Extrato from './components/Extrato';
import CategoriesTab from './components/CategoriesTab';
import ContextualOnboarding from './components/ContextualOnboarding';
import DebtAssistant from './components/DebtAssistant';
import QADiagnostic from './components/QADiagnostic';
import SupportTab from './components/SupportTab';
import AdminSupport from './components/AdminSupport';
import LegalModal from './components/LegalModal';
import Paywall from './components/Paywall';
import LandingPage from './components/LandingPage';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { normalizeCard, normalizeGoal, normalizeReminder, normalizeLimit, normalizeWallet, normalizeUserCategory, normalizeTransaction, normalizeDebt, assertSchema } from './services/normalizationService';

import { motion, AnimatePresence } from 'motion/react';
import { Zap } from 'lucide-react';

const App: React.FC = () => {
  useEffect(() => {
    console.log("GB: Aplicativo iniciado com sucesso!");
  }, []);

  const [session, setSession] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [sidebarExpanded, setSidebarExpanded] = useState(false); // Oculto por padrão
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [onboardingStep, setOnboardingStep] = useState<'none' | 'welcome' | 'lgpd' | 'setup' | 'guided'>('none');
  const [indexedDbError, setIndexedDbError] = useState(false);

  useEffect(() => {
    const handleIndexedDbError = (event: any) => {
      const msg = event.reason?.message || event.message || "";
      if (msg.includes("Indexed Database server lost") || msg.includes("IndexedDB")) {
        console.error("GB: Erro crítico de IndexedDB detectado:", msg);
        localStorage.setItem('gb_disable_persistence', 'true');
        setIndexedDbError(true);
      }
    };

    window.addEventListener('unhandledrejection', handleIndexedDbError);
    window.addEventListener('error', handleIndexedDbError);

    return () => {
      window.removeEventListener('unhandledrejection', handleIndexedDbError);
      window.removeEventListener('error', handleIndexedDbError);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Bloqueio de conta excluída/inativa
            if (userData.status === 'deleted' || userData.isActive === false) {
              console.log("GB: Usuário com status restrito no onAuthStateChanged:", userData.status);
              // Não fazemos signOut automático aqui para evitar race conditions com o fluxo de reativação no handlePostAuth
              // Apenas não definimos a sessão, o que mantém o usuário na tela de login/landing
              setSession(null);
              setIsInitializing(false);
              return;
            }

            const isAdminEmail = firebaseUser.email?.toLowerCase() === 'gbfinancer@gmail.com' || firebaseUser.email?.toLowerCase() === 'blsseparate7@gmail.com';
            const userSession: UserSession = {
              uid: firebaseUser.uid,
              userId: userData.userId,
              name: userData.name,
              email: firebaseUser.email || '',
              isLoggedIn: true,
              role: isAdminEmail ? 'admin' : (userData.role || 'user'),
              subscriptionStatus: userData.subscriptionStatus || 'inactive',
              plan: userData.plan,
              trialEndsAt: userData.trialEndsAt,
              subscriptionEndsAt: userData.subscriptionEndsAt,
              paymentProvider: userData.paymentProvider,
              onboardingSeen: userData.onboardingSeen,
              onboardingStatus: userData.onboardingStatus || { step: 1, completed: false },
              lgpdAccepted: userData.lgpdAccepted,
              status: userData.status || 'active',
              photoURL: userData.photoURL,
              spendingLimit: userData.spendingLimit,
              incomeProfile: userData.incomeProfile,
              suggestedGoals: userData.suggestedGoals
            };
            setSession(userSession);

            // Garante categorias padrão
            const { ensureDefaultCategories } = await import('./services/categoryService');
            await ensureDefaultCategories(firebaseUser.uid);

            // Auto-upgrade role in Firestore if needed
            if (isAdminEmail && userData.role !== 'admin') {
              const { syncUserData } = await import('./services/databaseService');
              await syncUserData(firebaseUser.uid, { role: 'admin' });
            }
            
            if (!userData.onboardingSeen) {
              setOnboardingStep('welcome');
            } else if (!userData.lgpdAccepted) {
              setOnboardingStep('lgpd');
            }
          } else {
            // Caso o usuário exista no Auth mas não no Firestore (ex: após exclusão parcial ou durante o signup)
            console.warn("GB: Usuário no Auth mas sem documento no Firestore. Aguardando criação...");
            // Não fazemos signOut aqui, pois o Auth.tsx pode estar criando o documento agora mesmo
            setSession(null);
          }
        } catch (err) {
          console.error("GB: Erro ao carregar dados do usuário no onAuthStateChanged:", err);
          setSession(null);
        }
      } else {
        setSession(null);
        setOnboardingStep('none');
      }
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Listeners Real-time Centralizados
  useEffect(() => {
    if (!session?.uid) return;
    const userRef = doc(db, "users", session.uid);

    setLoadingTransactions(true);
    setLoadingCards(true);
    setLoadingGoals(true);
    setLoadingReminders(true);
    setLoadingLimits(true);
    setLoadingWallets(true);
    setLoadingCategories(true);

    // Listeners Real-time Centralizados
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const handleError = (err: any, name: string) => {
      console.error(`GB: Erro no listener ${name}:`, err);
      // Opcional: Notificar usuário ou tentar reconectar
    };

    const unsubTrans = onSnapshot(query(
      collection(userRef, "transactions"), 
      where("date", ">=", startOfMonth),
      orderBy("date", "desc"), 
      limit(500)
    ), (snap) => {
      const normalized = snap.docs.map(d => normalizeTransaction(d));
      setTransactions(normalized);
      setLoadingTransactions(false);
      assertSchema(session.uid, { transactions: normalized, goals, cards });
    }, (err) => handleError(err, "Transactions"));

    const unsubGoals = onSnapshot(collection(userRef, "goals"), (snap) => {
      setGoals(snap.docs.map(d => normalizeGoal(d, session.uid)));
      setLoadingGoals(false);
    }, (err) => handleError(err, "Goals"));

    const unsubReminders = onSnapshot(collection(userRef, "reminders"), (snap) => {
      setReminders(snap.docs.map(d => normalizeReminder(d)));
      setLoadingReminders(false);
    }, (err) => handleError(err, "Reminders"));

    const unsubLimits = onSnapshot(collection(userRef, "limits"), (snap) => {
      setLimits(snap.docs.map(d => normalizeLimit(d)));
      setLoadingLimits(false);
    }, (err) => handleError(err, "Limits"));

    const unsubCards = onSnapshot(collection(userRef, "cards"), (snap) => {
      setCards(snap.docs.map(d => normalizeCard(d, session.uid)));
      setLoadingCards(false);
    }, (err) => handleError(err, "Cards"));

    const unsubWallets = onSnapshot(collection(userRef, "wallets"), (snap) => {
      setWallets(snap.docs.map(d => normalizeWallet(d, session.uid)));
      setLoadingWallets(false);
    }, (err) => handleError(err, "Wallets"));

    const unsubCats = onSnapshot(collection(userRef, "categories"), (snap) => {
      setCategories(snap.docs.map(d => normalizeUserCategory(d)));
      setLoadingCategories(false);
    }, (err) => handleError(err, "Categories"));

    const unsubDebts = onSnapshot(collection(userRef, "debts"), (snap) => {
      setDebts(snap.docs.map(d => normalizeDebt(d)));
      setLoadingDebts(false);
    }, (err) => handleError(err, "Debts"));

    const unsubPatterns = onSnapshot(collection(userRef, "categoryPatterns"), (snap) => {
      setCategoryPatterns(snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryPattern)));
    }, (err) => handleError(err, "Patterns"));

    const unsubNotifs = onSnapshot(query(collection(userRef, "notifications"), orderBy("createdAt", "desc"), limit(20)), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    }, (err) => handleError(err, "Notifications"));

    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const userData = snap.data();
        setSession(prev => {
          if (!prev) return null;
          const isAdminEmail = prev.email?.toLowerCase() === 'gbfinancer@gmail.com' || prev.email?.toLowerCase() === 'blsseparate7@gmail.com';
          return { 
            ...prev, 
            ...userData,
            role: isAdminEmail ? 'admin' : (userData.role || prev.role || 'user')
          };
        });
      }
    }, (err) => handleError(err, "User"));

    const unsubOnboarding = onSnapshot(doc(db, "users", session.uid, "onboarding", "flags"), (snap) => {
      if (snap.exists()) {
        setOnboarding(snap.data() as UserOnboarding);
      } else {
        setOnboarding({});
      }
    }, (err) => handleError(err, "Onboarding"));

    const unsubMessages = onSnapshot(query(
      collection(userRef, "chat_messages"),
      orderBy("createdAt", "desc"),
      limit(50)
    ), (snap) => {
      console.log("[chat] listener update");
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as Message));
      // Reverter para exibir em ordem cronológica (mais antiga em cima, mais nova embaixo)
      setMessages(msgs.reverse());
    }, (err) => {
      console.error("[chat] error no listener de chat_messages:", err);
      handleError(err, "Messages");
    });

    return () => { 
      unsubTrans(); unsubGoals(); unsubReminders(); 
      unsubLimits(); unsubCards(); unsubWallets(); unsubNotifs(); unsubCats(); unsubDebts(); unsubPatterns();
      unsubOnboarding(); unsubMessages(); unsubUser();
    };
  }, [session?.uid]);

  useEffect(() => {
    if (activeTab !== 'support') {
      setSupportContext(null);
    }
  }, [activeTab]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reminders, setReminders] = useState<Bill[]>([]);
  const [limits, setLimits] = useState<CategoryLimit[]>([]);
  const [cards, setCards] = useState<CreditCardInfo[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [categoryPatterns, setCategoryPatterns] = useState<CategoryPattern[]>([]);
  const [extratoFilters, setExtratoFilters] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<UserOnboarding>({});
  const [supportContext, setSupportContext] = useState<any>(null);

  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingDebts, setLoadingDebts] = useState(true);

  const handleOnboardingFinish = () => {
    setOnboardingStep('lgpd');
  };

  const handleLGPDAccept = async () => {
    if (!session?.uid) return;
    const { syncUserData } = await import('./services/databaseService');
    await syncUserData(session.uid, { 
      lgpdAccepted: true,
      lgpdAcceptedAt: new Date(),
      lgpdVersion: "1.0"
    });
    setSession(prev => prev ? { ...prev, lgpdAccepted: true } : null);
    setOnboardingStep('guided');
  };

  // Monitor de Re-abertura do Wizard (Passo 4 do Onboarding)
  useEffect(() => {
    if (session?.onboardingStatus?.step === 4 && !session.onboardingStatus.completed && onboardingStep === 'none') {
      const timer = setTimeout(() => {
        setOnboardingStep('setup');
      }, 5000); // Dá 5 segundos pro usuário ler o feedback no chat antes de abrir o wizard
      return () => clearTimeout(timer);
    }
  }, [session?.onboardingStatus?.step, onboardingStep]);

  const handleSetupComplete = async (data: { 
    incomeProfile?: any; 
    bills?: any[]; 
    goals?: any[]; 
    spendingLimit?: number;
    onboardingSeen?: boolean;
  }, phase: number) => {
    if (!session?.uid || !session.onboardingStatus) return;
    
    if (phase === 1) {
      // Phase 1: Income + Bills
      const newStatus = await saveWizardPhase1(session.uid, { 
        incomeProfile: data.incomeProfile!, 
        bills: data.bills || [] 
      });
      
      setSession(prev => prev ? { ...prev, onboardingStatus: newStatus, incomeProfile: data.incomeProfile } : null);
      setOnboardingStep('none'); 
      setActiveTab('chat');
    } else {
      // Phase 2: Goals + Finalize
      const finalStatus = await finalizeOnboarding(session.uid, { 
        goals: data.goals || [],
        spendingLimit: data.spendingLimit
      }, session.onboardingStatus);
      
      setSession(prev => prev ? { ...prev, onboardingStatus: finalStatus, onboardingSeen: true } : null);
      setOnboardingStep('none');
    }
  };

  const hasAccess = () => {
    if (!session) return false;
    if (session.role === 'admin') return true;
    
    const now = new Date();

    if (session.subscriptionStatus === 'active') {
      if (!session.subscriptionEndsAt) return true;
      return new Date(session.subscriptionEndsAt) > now;
    }

    if (session.subscriptionStatus === 'trial' && session.trialEndsAt) {
      return new Date(session.trialEndsAt) > now;
    }

    return false;
  };

  const trialWarning = (() => {
    if (!session || session.subscriptionStatus !== 'trial' || !session.trialEndsAt) return null;
    const trialEnd = new Date(session.trialEndsAt);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return null;
    if (diffDays <= 1) return "Seu acesso de teste expira em menos de 24h!";
    if (diffDays <= 3) return `Seu período de teste termina em ${diffDays} dias`;
    return null;
  })();

  if (isInitializing) return <div className="h-dvh bg-[var(--bg-body)] flex items-center justify-center text-[var(--green-whatsapp)] font-black italic animate-pulse">GB...</div>;
  
  if (!session && activeTab !== 'support') return <LandingPage onLogin={(s) => setSession(s)} onOpenSupport={() => setActiveTab('support')} />;

  const renderContent = () => {
    if (onboardingStep === 'welcome' && session) {
      return <WelcomeOnboarding userName={session.name} onFinish={handleOnboardingFinish} />;
    }
    if (onboardingStep === 'lgpd' && session) {
      return <LGPDOnboarding onAccept={handleLGPDAccept} />;
    }
    if (onboardingStep === 'setup' && session) {
      const step = session.onboardingStatus?.step || 1;
      // Se estiver no passo 3 (Chat), não mostramos o SetupWizard aqui,
      // ele reaparecerá no passo 4.
      if (step === 3) return null; 

      return (
        <SetupWizard 
          user={session} 
          initialStep={step >= 4 ? 4 : 1}
          onComplete={handleSetupComplete} 
        />
      );
    }

    // O Paywall agora é um overlay, então renderizamos o conteúdo normalmente
    // e o App.tsx decide se mostra o overlay por cima no return principal
    
    switch (activeTab) {
      case 'chat': return session ? (
        <ChatInterface 
          user={session} 
          messages={messages} 
          setMessages={setMessages} 
          transactions={transactions} 
          limits={limits} 
          reminders={reminders} 
          cards={cards} 
          wallets={wallets} 
          categories={categories} 
          goals={goals} 
          debts={debts}
          categoryPatterns={categoryPatterns}
          onToggleSidebar={handleToggleSidebar}
          onOpenProfile={() => setActiveTab('profile')}
          onNavigateToExtrato={(filters) => {
            setExtratoFilters(filters);
            setActiveTab('extrato');
          }}
          onNavigateToSupport={(context) => {
            setSupportContext(context);
            setActiveTab('support');
          }}
          isExpired={!hasAccess()}
        />
      ) : <LandingPage onLogin={(s) => setSession(s)} onOpenSupport={() => setActiveTab('support')} />;
      case 'extrato': return session ? (
        <Extrato 
          uid={session.uid} 
          transactions={transactions} 
          loading={loadingTransactions} 
          cards={cards} 
          categories={categories} 
          wallets={wallets} 
          initialFilters={extratoFilters}
          onClearInitialFilters={() => setExtratoFilters(null)}
        />
      ) : null;
      case 'categories': return session ? <CategoriesTab uid={session.uid} categories={categories} transactions={transactions} loading={loadingCategories || loadingTransactions} /> : null;
      case 'dash': return session ? (
        <Dashboard 
          transactions={transactions} 
          goals={goals} 
          limits={limits} 
          wallets={wallets} 
          reminders={reminders} 
          categories={categories} 
          uid={session.uid} 
          user={session} 
          loading={loadingCards || loadingGoals || loadingLimits || loadingWallets || loadingTransactions} 
          onNavigateToExtrato={(filters) => {
            setExtratoFilters(filters);
            setActiveTab('extrato');
          }}
          onNavigateToTab={(tab) => setActiveTab(tab)}
          isExpired={!hasAccess()}
        />
      ) : null;
      case 'calendar': return session ? <CalendarTab transactions={transactions} reminders={reminders} loading={loadingReminders || loadingTransactions} /> : null;
      case 'goals': return session ? <Goals goals={goals} transactions={transactions} wallets={wallets} uid={session.uid} user={session} loading={loadingGoals || loadingTransactions} isExpired={!hasAccess()} /> : null;
      case 'cc': return session ? <CreditCard transactions={transactions} uid={session.uid} cards={cards} wallets={wallets} loading={loadingCards} isExpired={!hasAccess()} /> : null;
      case 'reminders': return session ? <Reminders bills={reminders} wallets={wallets} uid={session.uid} loading={loadingReminders} isExpired={!hasAccess()} /> : null;
      case 'messages': return session ? <Messages notifications={notifications} /> : null;
      case 'resumo': return session ? <YearlySummary transactions={transactions} goals={goals} wallets={wallets} /> : null;
      case 'insights': return session ? <Insights transactions={transactions} limits={limits} /> : null;
      case 'score': return session ? <HealthScoreTab transactions={transactions} limits={limits} goals={goals} /> : null;
      case 'stress': return session ? <ImpactSimulator transactions={transactions} /> : null;
      case 'debts': return session ? <DebtAssistant uid={session.uid} transactions={transactions} wallets={wallets} user={session} goals={goals} cards={cards} debts={debts} isExpired={!hasAccess()} /> : null;
      case 'profile': return session ? <ProfileEdit user={session} onUpdate={(d) => setSession(p => p ? {...p, ...d} : null)} onLogout={() => signOut(auth)} setActiveTab={setActiveTab} /> : null;
      case 'support': return <SupportTab user={session} onBackToAuth={() => setActiveTab('chat')} initialContext={supportContext} />;
      case 'admin_support': return session?.role === 'admin' ? <AdminSupport admin={session} /> : null;
      case 'config': return session ? <Settings user={session} onLogout={() => signOut(auth)} /> : null;
      case 'qa':
        if (session?.role !== 'admin') return <div className="p-8 text-center text-red-500 font-bold">Acesso restrito</div>;
        return <QADiagnostic session={session} />;
      case 'admin': return session?.role === 'admin' ? <AdminPanel currentAdminId={session.uid} /> : null;
      case 'terms': return <LegalModal type="terms" onClose={() => setActiveTab('chat')} />;
      case 'privacy': return <LegalModal type="privacy" onClose={() => setActiveTab('chat')} />;
      case 'wallets': {
        if (!session) return null;
        const income = transactions
          .filter(t => t.type === 'INCOME')
          .reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const expense = transactions
          .filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD')
          .reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const totalSaved = goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);
        const freeBalance = income - expense - totalSaved;
        
        return (
          <WalletTab 
            uid={session.uid} 
            freeBalance={freeBalance} 
            goals={goals} 
            wallets={wallets} 
            transactions={transactions}
            loading={loadingWallets || loadingGoals} 
            onNavigateToExtrato={(filters) => {
              setExtratoFilters(filters);
              setActiveTab('extrato');
            }}
            isExpired={!hasAccess()}
          />
        );
      }
      default: return session ? (
        <ChatInterface 
          user={session} 
          messages={messages} 
          setMessages={setMessages}
          transactions={transactions} 
          limits={limits} 
          reminders={reminders} 
          goals={goals} 
          cards={cards}
          wallets={wallets}
          categories={categories}
          debts={debts}
          categoryPatterns={categoryPatterns}
          onToggleSidebar={handleToggleSidebar}
          onOpenProfile={() => setActiveTab('profile')}
          onNavigateToExtrato={(filters) => {
            setExtratoFilters(filters);
            setActiveTab('extrato');
          }}
          onNavigateToSupport={(context) => {
            setSupportContext(context);
            setActiveTab('support');
          }}
          highlightInput={onboardingStep === 'guided' && session.onboardingStatus?.step === 3}
        />
      ) : (
        <LandingPage onLogin={(s) => setSession(s)} onOpenSupport={() => setActiveTab('support')} />
      );
    }
  };

  const handleToggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  return (
    <div className={`flex h-dvh w-full overflow-hidden bg-[var(--bg-body)] text-[var(--text-primary)] transition-colors duration-300`}>
      
      {/* Erro Crítico de IndexedDB */}
      {indexedDbError && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
          <div className="bg-[var(--bg-card)] p-8 rounded-2xl shadow-2xl max-w-md border border-[var(--border-primary)]">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-2">Conexão com Banco de Dados Perdida</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              O navegador perdeu a conexão com o banco de dados local (IndexedDB). 
              Isso pode acontecer devido a economia de energia ou limpeza de cache.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-[var(--green-whatsapp)] text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
              >
                Recarregar Página
              </button>
              <button 
                onClick={async () => {
                  localStorage.removeItem('gb_disable_persistence');
                  try {
                    await clearIndexedDbPersistence(db);
                  } catch (e) {}
                  window.location.reload();
                }}
                className="w-full py-2 text-[var(--text-secondary)] text-xs hover:underline"
              >
                Tentar reativar banco de dados local
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay para fechar menu ao clicar fora */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/60 z-[190] animate-fade backdrop-blur-sm"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Sidebar - Drawer Lateral */}
      {session && (
        <div className={`
          fixed lg:absolute z-[200] h-full transition-all duration-300 ease-in-out shadow-2xl
          ${sidebarExpanded ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={(t) => { 
              setActiveTab(t); 
              setSidebarExpanded(false); 
            }} 
            expanded={true} 
            setExpanded={setSidebarExpanded} 
            role={session.role}
            onClose={() => setSidebarExpanded(false)}
            highlightedTab={onboardingStep === 'guided' && session.onboardingStatus?.step === 6 ? 'dash' : undefined}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {activeTab !== 'chat' && session && (
          <Header 
            activeTab={activeTab} 
            userName={session.name} 
            photoURL={session.photoURL} 
            notifications={notifications}
            onToggleSidebar={handleToggleSidebar} 
            onNavigate={(t) => {
              setActiveTab(t);
              setSidebarExpanded(false);
            }} 
            onLogout={() => signOut(auth)} 
          />
        )}
        <main className={`flex-1 min-w-0 relative bg-[var(--chat-bg)] flex flex-col ${activeTab === 'chat' ? 'h-full overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
          <div className="absolute inset-0 whatsapp-pattern pointer-events-none"></div>
          <div className="relative z-10 flex-1 flex flex-col min-h-0">
            {trialWarning && (
              <div className="bg-[#00A884] text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 px-4 text-center animate-pulse shrink-0 flex items-center justify-center gap-2">
                <Zap className="w-3 h-3" />
                {trialWarning}
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + onboardingStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
            {session && onboardingStep === 'none' && (
              <ContextualOnboarding 
                uid={session.uid} 
                activeTab={activeTab} 
                onboarding={onboarding} 
                setOnboarding={setOnboarding} 
              />
            )}
          </div>
        </main>

        {/* Paywall Overlay */}
        {session && !hasAccess() && activeTab !== 'support' && activeTab !== 'profile' && activeTab !== 'config' && (
          <Paywall user={session} onLogout={() => signOut(auth)} />
        )}

        {/* PWA Install Prompt */}
        {session && onboardingStep === 'none' && (
          <PWAInstallPrompt onClose={() => {}} />
        )}

        {/* Guided Onboarding Overlay */}
        {session && onboardingStep === 'guided' && (
          <GuidedOnboarding 
            user={session} 
            onComplete={handleSetupComplete} 
            onUpdateStatus={async (status) => {
              if (!session?.uid) return;
              const { syncUserData } = await import('./services/databaseService');
              
              // Se o status contiver campos que devem ir para a raiz (incomeProfile, billsProfile),
              // nós os extraímos e salvamos na raiz, mantendo o restante no onboardingStatus.
              const { incomeProfile, billsProfile, ...onboardingData } = status as any;
              
              const updateData: any = {
                onboardingStatus: { ...session.onboardingStatus, ...onboardingData }
              };
              
              if (incomeProfile) updateData.incomeProfile = incomeProfile;
              if (billsProfile) updateData.billsProfile = billsProfile;
              
              await syncUserData(session.uid, updateData);
            }}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}
      </div>
    </div>
  );
};

export default App;