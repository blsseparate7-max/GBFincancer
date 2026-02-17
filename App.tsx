
import React, { useState, useEffect } from 'react';
import { db, auth } from './services/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { UserSession, Transaction, SavingGoal, Notification, Message, Bill, CategoryLimit } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Auth from './components/Auth';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import Goals from './components/Goals';
import CreditCard from './components/CreditCard';
import Reminders from './components/Reminders';
import Messages from './components/Messages';
import ProfileEdit from './components/ProfileEdit';
import AdminPanel from './components/AdminPanel';
import SetupWizard from './components/SetupWizard';
import WelcomeOnboarding from './components/WelcomeOnboarding';
import HealthScoreTab from './components/HealthScoreTab';
import ImpactSimulator from './components/ImpactSimulator';
import YearlySummary from './components/YearlySummary';
import Settings from './components/Settings';
import { dispatchEvent } from './services/eventDispatcher';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reminders, setReminders] = useState<Bill[]>([]);
  const [limits, setLimits] = useState<CategoryLimit[]>([]);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Firebase Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Se houver um usuário, buscamos o perfil no Firestore
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setSession({
              uid: firebaseUser.uid,
              userId: userData.userId,
              name: userData.name,
              email: firebaseUser.email || '',
              isLoggedIn: true,
              role: userData.role || 'USER',
              subscriptionStatus: userData.subscriptionStatus || 'ACTIVE',
              onboardingSeen: userData.onboardingSeen,
              status: userData.status || 'active'
            });
          }
        } catch (error) {
          console.error("Erro ao carregar perfil do usuário:", error);
        }
      } else {
        setSession(null);
      }
      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === 'admin' && session?.role !== 'ADMIN') {
      setActiveTab('chat');
    }
    if (isMobile) setIsMobileMenuOpen(false);
  }, [activeTab, session?.role, isMobile]);

  useEffect(() => {
    if (!session?.uid) return;

    const userRef = doc(db, "users", session.uid);

    const checkOnboardingStatus = async () => {
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      
      if (!userData?.onboardingSeen) {
        setShowWelcome(true);
      }

      const transSnap = await getDocs(collection(userRef, "transactions"));
      if (transSnap.empty) {
        setShowSetupWizard(true);
      }
    };
    checkOnboardingStatus();

    const unsubTrans = onSnapshot(query(collection(userRef, "transactions"), orderBy("createdAt", "desc"), limit(200)), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    const unsubGoals = onSnapshot(collection(userRef, "goals"), (snap) => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavingGoal)));
    });

    const unsubNotifs = onSnapshot(query(collection(userRef, "notifications"), orderBy("createdAt", "desc"), limit(30)), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    const unsubReminders = onSnapshot(query(collection(userRef, "reminders"), orderBy("createdAt", "desc")), (snap) => {
      setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
    });

    const unsubLimits = onSnapshot(collection(userRef, "limits"), (snap) => {
      setLimits(snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryLimit)));
    });

    return () => { 
      unsubTrans(); 
      unsubGoals(); 
      unsubNotifs(); 
      unsubReminders();
      unsubLimits();
    };
  }, [session?.uid]);

  const handleWelcomeFinish = async () => {
    if (!session?.uid) return;
    const userRef = doc(db, "users", session.uid);
    await updateDoc(userRef, { onboardingSeen: true });
    setShowWelcome(false);
  };

  const handleSetupComplete = async (data: { income: number; bills: any[]; goal: any }) => {
    if (!session?.uid) return;
    
    await dispatchEvent(session.uid, {
      type: 'ADD_INCOME',
      payload: { amount: data.income, category: 'Salário', description: 'Renda Inicial', date: new Date().toISOString() },
      source: 'ui',
      createdAt: new Date()
    });

    for (const bill of data.bills) {
      await dispatchEvent(session.uid, {
        type: 'CREATE_REMINDER',
        payload: { 
          description: bill.description, 
          amount: bill.amount, 
          dueDay: bill.dueDay, 
          recurring: true 
        },
        source: 'ui',
        createdAt: new Date()
      });
    }

    if (data.goal?.name) {
      await dispatchEvent(session.uid, {
        type: 'CREATE_GOAL',
        payload: { 
          name: data.goal.name, 
          targetAmount: data.goal.targetAmount, 
          location: 'Não especificado', 
          currentAmount: 0 
        },
        source: 'ui',
        createdAt: new Date()
      });
    }

    setShowSetupWizard(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setSession(null);
  };

  // Splash Loading Screen
  if (isInitializing) {
    return (
      <div className="h-screen w-full bg-[#0B141A] flex flex-col items-center justify-center">
        <div className="absolute inset-0 whatsapp-pattern opacity-[0.05] pointer-events-none"></div>
        <div className="w-24 h-24 bg-[#00A884] rounded-[2.2rem] flex items-center justify-center mb-8 shadow-2xl shadow-[#00A884]/20 text-white text-5xl font-black italic animate-pulse border-4 border-white/10">
          GB
        </div>
        <div className="w-48 h-1.5 bg-[#111B21] rounded-full overflow-hidden relative">
          <div className="absolute top-0 left-0 h-full bg-[#00A884] w-1/3 animate-[loading_1.5s_infinite_ease-in-out]"></div>
        </div>
        <p className="mt-6 text-[10px] font-black text-[#8696A0] uppercase tracking-[0.3em] opacity-50">Validando Acesso Seguro...</p>
        <style>{`
          @keyframes loading {
            0% { left: -40%; width: 40%; }
            50% { left: 40%; width: 60%; }
            100% { left: 100%; width: 40%; }
          }
        `}</style>
      </div>
    );
  }

  if (!session) return <Auth onLogin={(s) => setSession(s)} />;

  if (session.status === 'blocked') {
    return (
      <div className="h-screen bg-[#0b141a] flex flex-col items-center justify-center p-10 text-center text-white">
        <h1 className="text-4xl font-black text-rose-500 mb-4 tracking-tighter uppercase italic">Acesso Restrito</h1>
        <p className="text-[#8696a0] max-w-sm mb-10">Sua conta foi temporariamente bloqueada pela administração do sistema.</p>
        <button onClick={handleLogout} className="bg-[#00a884] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase">Sair</button>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'admin': return session.role === 'ADMIN' ? <AdminPanel currentAdminId={session.uid} /> : <ChatInterface user={session} messages={messages} setMessages={setMessages} />;
      case 'chat': return <ChatInterface user={session} messages={messages} setMessages={setMessages} />;
      case 'dash': return <Dashboard transactions={transactions} goals={goals} limits={limits} uid={session.uid} />;
      case 'goals': return <Goals goals={goals} onDeleteGoal={() => {}} transactions={transactions} availableBalance={0} uid={session.uid} />;
      case 'cc': return <CreditCard transactions={transactions} uid={session.uid} />;
      case 'reminders': return <Reminders bills={reminders} uid={session.uid} />;
      case 'messages': return <Messages notifications={notifications} />;
      case 'resumo': return <YearlySummary transactions={transactions} />;
      case 'score': return <HealthScoreTab transactions={transactions} />;
      case 'stress': return <ImpactSimulator transactions={transactions} />;
      case 'profile': return <ProfileEdit user={session} onUpdate={(data) => setSession({...session, ...data})} onLogout={handleLogout} />;
      case 'config': return <Settings user={session} onLogout={handleLogout} />;
      default: return <ChatInterface user={session} messages={messages} setMessages={setMessages} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f0f2f5] text-[#111b21] overflow-hidden">
      {showWelcome && <WelcomeOnboarding userName={session.name} onFinish={handleWelcomeFinish} />}
      {!showWelcome && showSetupWizard && <SetupWizard user={session} onComplete={handleSetupComplete} />}
      
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[100] animate-fade"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className={`
        fixed lg:relative z-[110] h-full transition-transform duration-300
        ${isMobile ? (isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
      `}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          expanded={isMobile ? true : sidebarExpanded} 
          setExpanded={setSidebarExpanded} 
          role={session.role}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header 
          activeTab={activeTab} 
          userName={session.name} 
          onToggleSidebar={() => isMobile ? setIsMobileMenuOpen(true) : setSidebarExpanded(!sidebarExpanded)} 
        />
        
        <main className="flex-1 relative overflow-hidden bg-[#efeae2]">
          <div className="absolute inset-0 whatsapp-pattern pointer-events-none"></div>
          <div className="relative z-10 h-full overflow-y-auto no-scrollbar">
            {renderContent()}
          </div>
        </main>

        {isMobile && (
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-[#00a884] text-white rounded-full flex items-center justify-center shadow-2xl z-[120] active:scale-90 transition-transform border-4 border-[#efeae2]"
          >
            <span className="text-2xl font-black">$</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default App;
