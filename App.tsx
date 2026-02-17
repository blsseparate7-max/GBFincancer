import React, { useState, useEffect } from 'react';
import { db, auth } from './services/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { UserSession, Transaction, SavingGoal, Notification, Message, Bill, CategoryLimit, CreditCardInfo } from './types';
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

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [sidebarExpanded, setSidebarExpanded] = useState(false); // Oculto por padrão
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

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
          setSession({
            uid: firebaseUser.uid,
            userId: userData.userId,
            name: userData.name,
            email: firebaseUser.email || '',
            isLoggedIn: true,
            role: userData.role || 'USER',
            subscriptionStatus: userData.subscriptionStatus || 'ACTIVE',
            onboardingSeen: userData.onboardingSeen,
            status: userData.status || 'active',
            photoURL: userData.photoURL
          });
        }
      } else {
        setSession(null);
      }
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Listeners Real-time Centralizados
  useEffect(() => {
    if (!session?.uid) return;
    const userRef = doc(db, "users", session.uid);

    const unsubTrans = onSnapshot(query(collection(userRef, "transactions"), orderBy("createdAt", "desc"), limit(100)), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    const unsubGoals = onSnapshot(collection(userRef, "goals"), (snap) => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavingGoal)));
    });

    const unsubReminders = onSnapshot(collection(userRef, "reminders"), (snap) => {
      setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
    });

    const unsubLimits = onSnapshot(collection(userRef, "limits"), (snap) => {
      setLimits(snap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryLimit)));
    });

    const unsubCards = onSnapshot(collection(userRef, "cards"), (snap) => {
      setCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as CreditCardInfo)));
    });

    const unsubNotifs = onSnapshot(query(collection(userRef, "notifications"), orderBy("createdAt", "desc"), limit(20)), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    return () => { 
      unsubTrans(); unsubGoals(); unsubReminders(); 
      unsubLimits(); unsubCards(); unsubNotifs(); 
    };
  }, [session?.uid]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reminders, setReminders] = useState<Bill[]>([]);
  const [limits, setLimits] = useState<CategoryLimit[]>([]);
  const [cards, setCards] = useState<CreditCardInfo[]>([]);

  if (isInitializing) return <div className="h-dvh bg-[#0B141A] flex items-center justify-center text-[#00A884] font-black italic animate-pulse">GB...</div>;
  if (!session) return <Auth onLogin={(s) => setSession(s)} />;

  const renderContent = () => {
    switch (activeTab) {
      case 'chat': return <ChatInterface user={session} messages={messages} setMessages={setMessages} />;
      case 'dash': return <Dashboard transactions={transactions} goals={goals} limits={limits} uid={session.uid} />;
      case 'goals': return <Goals goals={goals} transactions={transactions} uid={session.uid} />;
      case 'cc': return <CreditCard transactions={transactions} uid={session.uid} />;
      case 'reminders': return <Reminders bills={reminders} uid={session.uid} />;
      case 'messages': return <Messages notifications={notifications} />;
      case 'resumo': return <YearlySummary transactions={transactions} />;
      case 'score': return <HealthScoreTab transactions={transactions} />;
      case 'stress': return <ImpactSimulator transactions={transactions} />;
      case 'profile': return <ProfileEdit user={session} onUpdate={(d) => setSession(p => p ? {...p, ...d} : null)} onLogout={() => signOut(auth)} />;
      case 'config': return <Settings user={session} onLogout={() => signOut(auth)} />;
      case 'admin': return session.role === 'ADMIN' ? <AdminPanel currentAdminId={session.uid} /> : null;
      default: return <ChatInterface user={session} messages={messages} setMessages={setMessages} />;
    }
  };

  const handleToggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  return (
    <div className="flex h-dvh w-full bg-[#0b141a] text-[#e9edef] overflow-hidden">
      
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
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
        <main className="flex-1 relative overflow-hidden bg-[#0b141a] flex flex-col">
          <div className="absolute inset-0 whatsapp-pattern pointer-events-none"></div>
          <div className="relative z-10 flex-1 min-h-0 h-full flex flex-col overflow-hidden">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;