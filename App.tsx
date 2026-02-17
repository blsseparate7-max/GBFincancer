
import React, { useState, useEffect } from 'react';
import { db } from './services/firebaseConfig';
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { UserSession, Transaction, SavingGoal, Notification, Message, Bill, PaymentMethod, CategoryLimit } from './types';
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
  const [activeTab, setActiveTab] = useState('chat');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reminders, setReminders] = useState<Bill[]>([]);
  const [limits, setLimits] = useState<CategoryLimit[]>([]);

  // Proteção reativa para a aba Admin
  useEffect(() => {
    if (activeTab === 'admin' && session?.role !== 'ADMIN') {
      setActiveTab('chat');
    }
  }, [activeTab, session?.role]);

  useEffect(() => {
    const cached = localStorage.getItem('gb_session');
    if (cached) {
      try {
        setSession(JSON.parse(cached));
      } catch (e) {
        localStorage.removeItem('gb_session');
      }
    }
  }, []);

  useEffect(() => {
    if (!session?.uid) return;

    const userRef = doc(db, "users", session.uid);

    const checkOnboardingStatus = async () => {
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      
      // Se nunca viu o onboarding informativo
      if (!userData?.onboardingSeen) {
        setShowWelcome(true);
      }

      // Se não tem transações, mostra o assistente de setup (após o welcome)
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

  if (!session) return <Auth onLogin={(s) => setSession(s)} />;

  if (session.status === 'blocked') {
    return (
      <div className="h-screen bg-[#0b141a] flex flex-col items-center justify-center p-10 text-center text-white">
        <h1 className="text-4xl font-black text-rose-500 mb-4 tracking-tighter uppercase italic">Acesso Restrito</h1>
        <p className="text-[#8696a0] max-w-sm mb-10">Sua conta foi temporariamente bloqueada pela administração do sistema.</p>
        <button onClick={() => setSession(null)} className="bg-[#00a884] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase">Sair</button>
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
      case 'profile': return <ProfileEdit user={session} onUpdate={(data) => setSession({...session, ...data})} onLogout={() => setSession(null)} />;
      case 'config': return <Settings user={session} onLogout={() => setSession(null)} />;
      default: return <ChatInterface user={session} messages={messages} setMessages={setMessages} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#f0f2f5] text-[#111b21] overflow-hidden">
      {showWelcome && <WelcomeOnboarding userName={session.name} onFinish={handleWelcomeFinish} />}
      {!showWelcome && showSetupWizard && <SetupWizard user={session} onComplete={handleSetupComplete} />}
      
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} expanded={sidebarExpanded} setExpanded={setSidebarExpanded} role={session.role} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header activeTab={activeTab} userName={session.name} onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)} />
        <main className="flex-1 relative overflow-hidden bg-[#efeae2]">
          <div className="absolute inset-0 whatsapp-pattern pointer-events-none"></div>
          <div className="relative z-10 h-full overflow-y-auto no-scrollbar">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
