import React, { useState, useEffect } from 'react';
import { db, auth } from './services/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { UserSession, Transaction, SavingGoal, Notification, Message, Bill, CategoryLimit, CreditCardInfo, Wallet, UserCategory, UserOnboarding } from './types';
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
import WelcomeOnboarding from './components/WelcomeOnboarding';
import LGPDOnboarding from './components/LGPDOnboarding';
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
import LegalModal from './components/LegalModal';
import { normalizeCard, normalizeGoal, normalizeReminder, normalizeLimit, normalizeWallet, normalizeUserCategory, normalizeTransaction, assertSchema } from './services/normalizationService';

import { motion, AnimatePresence } from 'motion/react';

const App: React.FC = () => {
  useEffect(() => {
    console.log("GB: Aplicativo iniciado com sucesso!");
  }, []);

  const [session, setSession] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [sidebarExpanded, setSidebarExpanded] = useState(false); // Oculto por padrão
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [onboardingStep, setOnboardingStep] = useState<'none' | 'welcome' | 'lgpd' | 'setup'>('none');

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
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userSession: UserSession = {
            uid: firebaseUser.uid,
            userId: userData.userId,
            name: userData.name,
            email: firebaseUser.email || '',
            isLoggedIn: true,
            role: userData.role || 'USER',
            subscriptionStatus: userData.subscriptionStatus || 'ACTIVE',
            onboardingSeen: userData.onboardingSeen,
            lgpdAccepted: userData.lgpdAccepted,
            status: userData.status || 'active',
            photoURL: userData.photoURL
          };
          setSession(userSession);
          
          if (!userData.onboardingSeen) {
            setOnboardingStep('welcome');
          } else if (!userData.lgpdAccepted) {
            setOnboardingStep('lgpd');
          }
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

    setLoadingCards(true);
    setLoadingGoals(true);
    setLoadingReminders(true);
    setLoadingLimits(true);
    setLoadingWallets(true);
    setLoadingCategories(true);

    const unsubTrans = onSnapshot(query(collection(userRef, "transactions"), orderBy("createdAt", "desc"), limit(100)), (snap) => {
      const normalized = snap.docs.map(d => normalizeTransaction(d));
      setTransactions(normalized);
      assertSchema(session.uid, { transactions: normalized, goals, cards });
    });

    const unsubGoals = onSnapshot(collection(userRef, "goals"), (snap) => {
      setGoals(snap.docs.map(d => normalizeGoal(d, session.uid)));
      setLoadingGoals(false);
    });

    const unsubReminders = onSnapshot(collection(userRef, "reminders"), (snap) => {
      setReminders(snap.docs.map(d => normalizeReminder(d)));
      setLoadingReminders(false);
    });

    const unsubLimits = onSnapshot(collection(userRef, "limits"), (snap) => {
      setLimits(snap.docs.map(d => normalizeLimit(d)));
      setLoadingLimits(false);
    });

    const unsubCards = onSnapshot(collection(userRef, "cards"), (snap) => {
      setCards(snap.docs.map(d => normalizeCard(d, session.uid)));
      setLoadingCards(false);
    });

    const unsubWallets = onSnapshot(collection(userRef, "wallets"), (snap) => {
      setWallets(snap.docs.map(d => normalizeWallet(d, session.uid)));
      setLoadingWallets(false);
    });

    const unsubCats = onSnapshot(collection(userRef, "categories"), (snap) => {
      setCategories(snap.docs.map(d => normalizeUserCategory(d)));
      setLoadingCategories(false);
    });

    const unsubNotifs = onSnapshot(query(collection(userRef, "notifications"), orderBy("createdAt", "desc"), limit(20)), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    const unsubOnboarding = onSnapshot(doc(db, "users", session.uid, "onboarding", "flags"), (snap) => {
      if (snap.exists()) {
        setOnboarding(snap.data() as UserOnboarding);
      } else {
        setOnboarding({});
      }
    });

    return () => { 
      unsubTrans(); unsubGoals(); unsubReminders(); 
      unsubLimits(); unsubCards(); unsubWallets(); unsubNotifs(); unsubCats();
      unsubOnboarding();
    };
  }, [session?.uid]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reminders, setReminders] = useState<Bill[]>([]);
  const [limits, setLimits] = useState<CategoryLimit[]>([]);
  const [cards, setCards] = useState<CreditCardInfo[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [onboarding, setOnboarding] = useState<UserOnboarding>({});

  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);

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
    setOnboardingStep('setup');
  };

  const handleSetupComplete = async (data: { incomeProfile: any; bills: any[]; goals: any[] }) => {
    if (!session?.uid) return;
    
    const { dispatchEvent } = await import('./services/eventDispatcher');
    const { syncUserData } = await import('./services/databaseService');

    let defaultWalletId = null;

    // 1. Criar Carteiras e Lembretes para Fontes de Renda
    if (data.incomeProfile?.sources) {
      for (const source of data.incomeProfile.sources) {
        if (source.amountExpected && source.frequency !== 'VARIABLE') {
          const dueDay = source.dates && source.dates.length > 0 ? source.dates[0] : 1;
          
          // Verificar se a carteira já existe ou criar uma nova
          let targetWalletId = null;
          if (source.targetWalletName) {
            const existingWallet = wallets.find(w => w.name.toLowerCase() === source.targetWalletName.toLowerCase());
            
            if (existingWallet) {
              targetWalletId = existingWallet.id;
            } else {
              const walletRes = await dispatchEvent(session.uid, {
                type: 'CREATE_WALLET',
                payload: {
                  name: source.targetWalletName,
                  type: 'CONTA',
                  balance: 0,
                  color: '#00A884',
                  icon: 'Wallet'
                },
                source: 'ui',
                createdAt: new Date()
              });
              // Como CREATE_WALLET não retorna o ID diretamente no dispatchEvent simplificado, 
              // vamos assumir que o listener vai atualizar as wallets em breve.
              // Para o onboarding, vamos apenas guardar o nome se necessário.
            }

            // Define a primeira carteira de recebimento como padrão
            if (!defaultWalletId) {
              defaultWalletId = targetWalletId || source.targetWalletName;
            }
          }

          await dispatchEvent(session.uid, {
            type: 'CREATE_REMINDER',
            payload: {
              description: `Recebimento: ${source.description}`,
              amount: source.amountExpected,
              dueDay: dueDay,
              category: 'Recebimento',
              type: 'RECEIVE',
              recurring: true,
              targetWalletName: source.targetWalletName
            },
            source: 'ui',
            createdAt: new Date()
          });
        }
      }
    }

    // 2. Salvar Perfil de Renda, Carteira Padrão e Marcar Onboarding como visto
    await syncUserData(session.uid, { 
      incomeProfile: data.incomeProfile,
      defaultReceivingWallet: defaultWalletId,
      onboardingSeen: true 
    });

    // 3. Salvar Contas Fixas
    for (const bill of data.bills) {
      await dispatchEvent(session.uid, {
        type: 'CREATE_REMINDER',
        payload: { 
          description: bill.description, 
          amount: bill.amount, 
          dueDay: bill.dueDay, 
          category: bill.type === 'RECEIVE' ? 'Recebimento' : 'Contas Fixas',
          type: bill.type || 'PAY',
          recurring: true
        },
        source: 'ui',
        createdAt: new Date()
      });
    }

    // 4. Salvar Metas Sugeridas
    if (data.goals && data.goals.length > 0) {
      await syncUserData(session.uid, { 
        suggestedGoals: data.goals 
      });
    }
    
    setSession(prev => prev ? { ...prev, onboardingSeen: true, incomeProfile: data.incomeProfile, suggestedGoals: data.goals } : null);
    setOnboardingStep('none');
  };

  if (isInitializing) return <div className="h-dvh bg-[var(--bg-body)] flex items-center justify-center text-[var(--green-whatsapp)] font-black italic animate-pulse">GB...</div>;
  if (!session) return <Auth onLogin={(s) => setSession(s)} />;

  const renderContent = () => {
    if (onboardingStep === 'welcome') {
      return <WelcomeOnboarding userName={session.name} onFinish={handleOnboardingFinish} />;
    }
    if (onboardingStep === 'lgpd') {
      return <LGPDOnboarding onAccept={handleLGPDAccept} />;
    }
    if (onboardingStep === 'setup') {
      return <SetupWizard user={session} onComplete={handleSetupComplete} />;
    }

    switch (activeTab) {
      case 'chat': return (
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
          onToggleSidebar={handleToggleSidebar}
          onOpenProfile={() => setActiveTab('profile')}
        />
      );
      case 'extrato': return <Extrato uid={session.uid} cards={cards} categories={categories} />;
      case 'categories': return <CategoriesTab uid={session.uid} categories={categories} loading={loadingCategories} />;
      case 'dash': return <Dashboard transactions={transactions} goals={goals} limits={limits} wallets={wallets} reminders={reminders} uid={session.uid} loading={loadingCards || loadingGoals || loadingLimits || loadingWallets} />;
      case 'calendar': return <CalendarTab transactions={transactions} reminders={reminders} loading={loadingReminders} />;
      case 'goals': return <Goals goals={goals} transactions={transactions} wallets={wallets} uid={session.uid} user={session} loading={loadingGoals} />;
      case 'cc': return <CreditCard transactions={transactions} uid={session.uid} cards={cards} wallets={wallets} loading={loadingCards} />;
      case 'reminders': return <Reminders bills={reminders} wallets={wallets} uid={session.uid} loading={loadingReminders} />;
      case 'messages': return <Messages notifications={notifications} />;
      case 'resumo': return <YearlySummary transactions={transactions} goals={goals} wallets={wallets} />;
      case 'insights': return <Insights transactions={transactions} limits={limits} />;
      case 'score': return <HealthScoreTab transactions={transactions} limits={limits} goals={goals} />;
      case 'stress': return <ImpactSimulator transactions={transactions} />;
      case 'debts': return <DebtAssistant uid={session.uid} transactions={transactions} wallets={wallets} user={session} goals={goals} cards={cards} />;
      case 'profile': return <ProfileEdit user={session} onUpdate={(d) => setSession(p => p ? {...p, ...d} : null)} onLogout={() => signOut(auth)} />;
      case 'config': return <Settings user={session} onLogout={() => signOut(auth)} />;
      case 'qa':
        if (session.role !== 'ADMIN') return <div className="p-8 text-center text-red-500 font-bold">Acesso restrito</div>;
        return <QADiagnostic session={session} />;
      case 'admin': return session.role === 'ADMIN' ? <AdminPanel currentAdminId={session.uid} /> : null;
      case 'terms': return <LegalModal type="terms" onClose={() => setActiveTab('chat')} />;
      case 'privacy': return <LegalModal type="privacy" onClose={() => setActiveTab('chat')} />;
      case 'wallets': {
        const income = transactions
          .filter(t => t.type === 'INCOME')
          .reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const expense = transactions
          .filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD')
          .reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const totalSaved = goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);
        const freeBalance = income - expense - totalSaved;
        
        return <WalletTab uid={session.uid} freeBalance={freeBalance} goals={goals} wallets={wallets} loading={loadingWallets || loadingGoals} />;
      }
      default: return <ChatInterface user={session} messages={messages} setMessages={setMessages} transactions={transactions} limits={limits} reminders={reminders} goals={goals} />;
    }
  };

  const handleToggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  return (
    <div className={`flex h-dvh w-full overflow-hidden ${activeTab === 'chat' ? 'theme-light' : ''} bg-[var(--bg-body)] text-[var(--text-primary)] transition-colors duration-300`}>
      
      {/* Overlay para fechar menu ao clicar fora */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/60 z-[190] animate-fade backdrop-blur-sm"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Sidebar - Drawer Lateral */}
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
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {activeTab !== 'chat' && (
          <Header 
            activeTab={activeTab} 
            userName={session.name} 
            photoURL={session.photoURL} 
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
      </div>
    </div>
  );
};

export default App;