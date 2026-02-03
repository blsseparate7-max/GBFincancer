
import React, { useState, useEffect } from 'react';
import { Transaction, SavingGoal, Message, UserProfile, UserSession, Category, Note, Bill } from './types';
import { processFinanceMessage } from './services/geminiService';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import Goals from './components/Goals';
import Auth from './components/Auth';
import Paywall from './components/Paywall';
import AdminPanel from './components/AdminPanel';
import ProfileModal from './components/ProfileModal';
import Reports from './components/Reports';
import Reminders from './components/Reminders';
import NotesList from './components/NotesList';
import HealthScoreTab from './components/HealthScoreTab';
import AdviceTab from './components/AdviceTab';
import ImpactSimulator from './components/ImpactSimulator';
import CategoryManager from './components/CategoryManager';
import Onboarding from './components/Onboarding';
import { fetchUserData, syncUserData, fetchAllCustomers } from './services/databaseService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [session, setSession] = useState<UserSession | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<UserProfile>({ 
    name: 'Usuário', 
    monthlyBudget: 0, 
    onboardingCompleted: false 
  });
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem('gb_session');
    if (cached) {
      const parsed = JSON.parse(cached);
      setSession(parsed);
      loadUserData(parsed.id);
    }
  }, []);

  const loadUserData = async (userId: string) => {
    const data = await fetchUserData(userId);
    if (data) {
      setTransactions(data.transactions || []);
      setMessages(data.messages || []);
      setGoals(data.goals || []);
      setBills(data.bills || []);
      setNotes(data.notes || []);
      setProfile({ 
        name: data.userName, 
        monthlyBudget: data.monthlyBudget || 0, 
        onboardingCompleted: data.onboardingCompleted || false 
      });
    }
  };

  useEffect(() => {
    if (session?.id) {
      const data = {
        transactions,
        goals,
        messages,
        bills,
        notes,
        userName: profile.name,
        monthlyBudget: profile.monthlyBudget,
        onboardingCompleted: profile.onboardingCompleted,
        lastActive: new Date().toISOString()
      };
      syncUserData(session.id, data);
    }
  }, [transactions, goals, messages, bills, notes, profile, session]);

  const handleLogin = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem('gb_session', JSON.stringify(newSession));
    loadUserData(newSession.id);
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('gb_session');
  };

  const handleOnboardingComplete = (data: { income: number; bills: Omit<Bill, 'id' | 'isPaid'>[] }) => {
    const newBills = data.bills.map(b => ({ ...b, id: Math.random().toString(36), isPaid: false }));
    setBills(newBills);
    setProfile(prev => ({ ...prev, monthlyBudget: data.income, onboardingCompleted: true }));
  };

  const handleSendMessage = async (text: string) => {
    const newUserMsg: Message = { id: Date.now().toString(), text, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, newUserMsg]);

    try {
      const result = await processFinanceMessage(text);
      if (result.intent === 'TRANSACTION' && result.transaction) {
        const newT: Transaction = {
          ...result.transaction,
          id: Math.random().toString(36),
          date: new Date().toISOString(),
          paymentMethod: 'Pix'
        };
        setTransactions(prev => [newT, ...prev]);
      } else if (result.intent === 'NOTE') {
        const newNote: Note = {
          id: Math.random().toString(36),
          content: text,
          timestamp: new Date().toISOString()
        };
        setNotes(prev => [newNote, ...prev]);
      }

      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: result.reply, 
        sender: 'ai', 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
    }
  };

  if (!session) return <Auth onLogin={handleLogin} />;

  if (session.subscriptionStatus === 'EXPIRED') {
    return <Paywall userName={session.name} onPay={() => setSession({...session, subscriptionStatus: 'ACTIVE'})} onLogout={handleLogout} />;
  }

  // Primeiro Login: Coletor de dados Onboarding
  if (!profile.onboardingCompleted && session.role !== 'ADMIN') {
    return <Onboarding user={session} onComplete={handleOnboardingComplete} />;
  }

  const navItems = [
    { id: 'chat', icon: '💬', label: 'Mensagens' },
    { id: 'home', icon: '📊', label: 'Dashboard' },
    { id: 'list', icon: '📝', label: 'Extrato' },
    { id: 'goals', icon: '🎯', label: 'Metas' },
    { id: 'reminders', icon: '⏰', label: 'Contas' },
    { id: 'reports', icon: '📈', label: 'Relatórios' },
    { id: 'notes', icon: '📓', label: 'Notas' },
    { id: 'stress', icon: '⚡', label: 'Stress Test' },
    { id: 'health', icon: '🩺', label: 'Saúde' },
    { id: 'advice', icon: '💡', label: 'Dicas' },
  ];

  if (session.role === 'ADMIN') {
    navItems.push({ id: 'admin', icon: '🛡️', label: 'Admin' });
  }

  return (
    <div className="h-viewport flex overflow-hidden font-sans">
      {/* Sidebar Premium Retrátil */}
      <aside 
        className={`sidebar-premium h-full flex flex-col transition-all duration-300 ease-in-out z-50 relative ${isSidebarExpanded ? 'w-64' : 'w-16'}`}
      >
        {/* Toggle Button: Símbolo $ */}
        <button 
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="absolute -right-3.5 top-10 w-7 h-7 bg-[#00a884] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all z-[60] font-bold text-xs"
        >
          $
        </button>

        <div className="p-4 flex items-center gap-3 border-b border-white/5 h-16 shrink-0 overflow-hidden">
          <div className="w-8 h-8 bg-[#00a884] rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0">G</div>
          {isSidebarExpanded && (
            <h1 className="text-white font-bold tracking-tight text-sm uppercase">GB Financer</h1>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar py-4">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center p-3 transition-colors ${isSidebarExpanded ? 'px-6 gap-5' : 'justify-center'} ${activeTab === item.id ? 'sidebar-item-active font-semibold' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
            >
              <span className="text-xl shrink-0">{item.icon}</span>
              {isSidebarExpanded && (
                <span className="text-[13px] whitespace-nowrap overflow-hidden text-ellipsis uppercase tracking-tighter">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button 
            onClick={() => setShowProfile(true)}
            className={`w-full flex items-center p-2 rounded-xl transition-all hover:bg-white/5 ${isSidebarExpanded ? 'gap-3' : 'justify-center'}`}
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-[#00a884] shrink-0 border border-white/5">
              {profile.photoURL ? <img src={profile.photoURL} alt="P" className="w-full h-full object-cover" /> : profile.name.charAt(0)}
            </div>
            {isSidebarExpanded && (
              <div className="text-left overflow-hidden">
                <p className="text-[12px] text-white font-medium truncate">{profile.name}</p>
                <p className="text-[10px] text-slate-500">Perfil</p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative bg-[#f0f2f5]">
        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'chat' && <ChatInterface messages={messages} onSend={handleSendMessage} />}
          {activeTab === 'home' && <Dashboard transactions={transactions} budget={profile.monthlyBudget} />}
          {activeTab === 'list' && <TransactionList transactions={transactions} onDelete={(id) => setTransactions(p => p.filter(t => t.id !== id))} />}
          {activeTab === 'goals' && (
            <Goals 
              goals={goals} 
              availableBalance={transactions.filter(t => t.type === 'INCOME').reduce((s,t) => s+t.amount,0) - transactions.filter(t => t.type === 'EXPENSE').reduce((s,t) => s+t.amount,0)}
              onAddGoal={(g) => setGoals(p => [...p, { ...g, id: Math.random().toString(36), createdAt: new Date().toISOString(), ativa: true }])}
              onUpdateGoal={(id, updates) => setGoals(p => p.map(g => g.id === id ? {...g, ...updates} : g))}
              onDeleteGoal={(id) => setGoals(p => p.filter(g => g.id !== id))}
              transactions={transactions}
              userAssets={{ hasCar: false, carValue: 0, hasHouse: false, houseValue: 0, savingsValue: 0, surveyCompleted: goals.length > 0, targets: { car: 50000, house: 200000 } }}
              onUpdateAssets={(a) => console.log('Assets updated:', a)}
            />
          )}
          {activeTab === 'reminders' && (
            <Reminders 
              bills={bills}
              onToggleBill={(id) => setBills(p => p.map(b => b.id === id ? {...b, isPaid: !b.isPaid} : b))}
              onDeleteBill={(id) => setBills(p => p.filter(b => b.id !== id))}
              onPayBill={(id, method) => {
                const b = bills.find(x => x.id === id);
                if (b) {
                  setTransactions(prev => [{
                    id: Math.random().toString(36),
                    description: `Pgmto: ${b.description}`,
                    amount: b.amount,
                    type: 'EXPENSE',
                    category: 'Contas Fixas',
                    date: new Date().toISOString(),
                    paymentMethod: method
                  }, ...prev]);
                  setBills(p => p.map(x => x.id === id ? {...x, isPaid: true} : x));
                }
              }}
              onAddBill={(b) => setBills(p => [{...b, id: Math.random().toString(36), isPaid: false}, ...p])}
              onUpdateBill={(id, updates) => setBills(p => p.map(b => b.id === id ? {...b, ...updates} : b))}
            />
          )}
          {activeTab === 'reports' && <Reports transactions={transactions} goals={goals} />}
          {activeTab === 'notes' && <NotesList notes={notes} onDeleteNote={(id) => setNotes(p => p.filter(n => n.id !== id))} />}
          {activeTab === 'stress' && <ImpactSimulator transactions={transactions} goals={goals} />}
          {activeTab === 'health' && <HealthScoreTab transactions={transactions} goals={goals} onNavigateToGoals={() => setActiveTab('goals')} />}
          {activeTab === 'advice' && <AdviceTab transactions={transactions} goals={goals} />}
        </div>
      </main>

      {showProfile && (
        <ProfileModal 
          user={session} 
          onClose={() => setShowProfile(false)} 
          onLogout={handleLogout}
          onUpdate={(u) => { setProfile(prev => ({...prev, ...u})); setShowProfile(false); }}
          onManageCategories={() => { setShowCatManager(true); setShowProfile(false); }}
        />
      )}

      {showCatManager && (
        <div className="fixed inset-0 z-[100] bg-white animate-in slide-in-from-bottom duration-300">
           <CategoryManager 
              categories={categories} 
              transactions={transactions} 
              onClose={() => setShowCatManager(false)} 
              isFullPage={true}
              onAdd={(name, type) => setCategories(prev => [...prev, { name, type }])}
              onRemove={(name) => setCategories(prev => prev.filter(c => c.name !== name))}
              onEdit={(old, next) => setCategories(prev => prev.map(c => c.name === old ? {...c, name: next} : c))}
           />
        </div>
      )}
    </div>
  );
};

export default App;
