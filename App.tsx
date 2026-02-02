
import React, { useState, useEffect, useMemo } from 'react';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import Goals from './components/Goals';
import HealthScoreTab from './components/HealthScoreTab';
import Reports from './components/Reports';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import ProfileModal from './components/ProfileModal';
import Reminders from './components/Reminders';
import CategoryManager from './components/CategoryManager';
import AdminPanel from './components/AdminPanel';
import AdviceTab from './components/AdviceTab';
import ImpactSimulator from './components/ImpactSimulator';
import { Transaction, CategoryLimit, SavingGoal, UserSession, Message, Bill, Note, Category, UserAssets, CustomerData, GoalType } from './types';
import { syncUserData, fetchUserData, fetchAllCustomers } from './services/databaseService';

type ActiveTab = 'chat' | 'dashboard' | 'transactions' | 'reports' | 'goals' | 'score' | 'messages_tab' | 'reminders' | 'admin' | 'categories' | 'simulator';

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>([]);
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [budget, setBudget] = useState<number>(0); 
  const [metaEconomia, setMetaEconomia] = useState<number>(0);
  const [allCustomers, setAllCustomers] = useState<CustomerData[]>([]);
  const [userAssets, setUserAssets] = useState<UserAssets>({
    hasCar: false, carValue: 0, hasHouse: false, houseValue: 0, hasSavings: false, savingsValue: 0,
    targets: { car: 20000, house: 150000, savings: 1000 }, surveyCompleted: false
  });

  const [categories, setCategories] = useState<Category[]>([
    { name: 'Cartão de Crédito', type: 'EXPENSE' },
    { name: 'Alimentação', type: 'EXPENSE' }, 
    { name: 'Moradia', type: 'EXPENSE' },
    { name: 'Transporte', type: 'EXPENSE' }, 
    { name: 'Lazer', type: 'EXPENSE' },
    { name: 'Metas', type: 'EXPENSE' }, 
    { name: 'Salário', type: 'INCOME' },
    { name: 'Supermercado', type: 'EXPENSE' }, 
    { name: 'Saúde', type: 'EXPENSE' },
    { name: 'Assinaturas', type: 'EXPENSE' }, 
    { name: 'Contas', type: 'EXPENSE' }
  ]);

  useEffect(() => {
    const initApp = async () => {
      const session = localStorage.getItem('gb_current_session');
      if (session) setUser(JSON.parse(session));
      setIsLoading(false);
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchUserData(user.id).then(data => {
        if (data) {
          setTransactions(data.transactions || []);
          setGoals(data.goals || []);
          setCategoryLimits(data.categoryLimits || []);
          setMessages(data.messages || []);
          setBills(data.bills || []);
          setNotes(data.notes || []);
          if (data.budget) setBudget(data.budget);
          if (data.metaEconomiaMensal) setMetaEconomia(data.metaEconomiaMensal);
          if (data.categories) setCategories(data.categories);
          if (data.userAssets) setUserAssets(data.userAssets);
        } else {
          setShowOnboarding(true);
        }
      });
      if (user.role === 'ADMIN') fetchAllCustomers().then(setAllCustomers);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user) return;
    syncUserData(user.id, { 
      transactions, goals, messages, bills, notes, 
      categoryLimits, categories, budget, metaEconomiaMensal: metaEconomia, userAssets 
    });
  }, [transactions, categoryLimits, goals, messages, bills, notes, categories, budget, metaEconomia, userAssets]);

  const handlePayBill = (id: string, method: string = 'PIX') => {
    const bill = bills.find(b => b.id === id);
    if (bill && !bill.isPaid) {
      setBills(p => p.map(b => b.id === id ? { ...b, isPaid: true } : b));
      setTransactions(p => [{
        id: Math.random().toString(36),
        description: `Pgto Fixo: ${bill.description}`,
        amount: bill.amount,
        category: 'Contas',
        type: 'EXPENSE',
        date: new Date().toISOString(),
        paymentMethod: method,
        isFixed: true
      }, ...p]);

      if (bill.isRecurring) {
        const nextDueDate = new Date(bill.dueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        setBills(p => [...p, {
          ...bill,
          id: Math.random().toString(36),
          dueDate: nextDueDate.toISOString(),
          isPaid: false
        }]);
      }
    }
  };

  const handleGoalOperation = (nameOrType: string, amount: number, type: 'ADD' | 'REMOVE', metaHint: string = ''): { success: boolean, feedback: string } => {
    let feedback = "";
    let success = false;
    let nextMetaToCreate: Omit<SavingGoal, 'id' | 'createdAt'> | null = null;
    const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    const now = new Date();
    const curMonthT = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const income = curMonthT.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0);
    const expense = curMonthT.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);
    const capacidadeGuardarMes = Math.max(0, income - expense);

    setGoals(prev => {
      let targetIndex = prev.findIndex(g => g.ativa && g.tipo === metaHint);
      if (targetIndex === -1) {
        targetIndex = prev.findIndex(g => g.ativa && (g.name.toLowerCase().includes(nameOrType.toLowerCase()) || g.tipo.toLowerCase() === nameOrType.toLowerCase()));
      }
      if (targetIndex === -1) targetIndex = prev.findIndex(g => g.ativa && g.tipo === 'reserva');

      if (targetIndex !== -1) {
        const newGoals = [...prev];
        const goal = newGoals[targetIndex];
        goal.currentAmount = Math.max(0, goal.currentAmount + (amount * (type === 'ADD' ? 1 : -1)));
        success = true;
        
        const progressoPct = Math.min(100, Math.floor((goal.currentAmount / goal.targetAmount) * 100));
        const faltante = Math.max(0, goal.targetAmount - goal.currentAmount);

        if (goal.currentAmount >= goal.targetAmount) {
          const surplus = goal.currentAmount - goal.targetAmount;
          goal.ativa = false;
          goal.concluidaEm = new Date().toISOString();
          goal.currentAmount = goal.targetAmount;
          const nextTarget = Math.round((goal.targetAmount * 1.30) / 100) * 100;
          nextMetaToCreate = { name: goal.name, tipo: goal.tipo, targetAmount: nextTarget, currentAmount: surplus, prazoMeses: goal.prazoMeses, nivelEscada: goal.nivelEscada + 1, ativa: true, monthlySaving: (nextTarget - surplus) / goal.prazoMeses };
          feedback = `Boa! Você guardou ${currency.format(amount)} 👏\nMeta: ${goal.name}. Concluída! 🎉 Próximo nível: ${currency.format(nextTarget)}.`;
        } else {
          const meses = capacidadeGuardarMes > 0 ? Math.ceil(faltante / capacidadeGuardarMes) : null;
          feedback = `Boa! Você guardou ${currency.format(amount)} 👏\nMeta: ${goal.name}. Progresso: ${progressoPct}%.\nFaltam ${currency.format(faltante)}. ${meses ? `Conclui em ~${meses} meses.` : 'Sobra insuficiente no mês.'}`;
        }
        return nextMetaToCreate ? [...newGoals, { ...nextMetaToCreate, id: Math.random().toString(36), createdAt: new Date().toISOString() } as SavingGoal] : newGoals;
      }
      return prev;
    });
    return { success, feedback: feedback || "Nenhuma meta encontrada." };
  };

  const NavItem = ({ id, icon, label }: { id: ActiveTab, icon: React.ReactNode, label: string }) => (
    <button onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }} className={`flex flex-col items-center justify-center w-full py-4 shrink-0 transition-all ${activeTab === id ? 'text-emerald-400 bg-emerald-500/10 border-r-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
      {icon}
      <span className="text-[7px] font-black uppercase mt-1 text-center px-1 leading-tight">{label}</span>
    </button>
  );

  if (isLoading) return <div className="h-viewport w-full flex items-center justify-center bg-slate-950 text-emerald-500 font-black">GB CARREGANDO...</div>;
  if (!user) return <Auth onLogin={setUser} />;
  if (showOnboarding) return <Onboarding user={user} onComplete={({ income, bills: b }) => {
    setTransactions([{ id: 'init', description: 'Salário Inicial', amount: income, category: 'Salário', type: 'INCOME', date: new Date().toISOString(), paymentMethod: 'PIX' }]);
    setBills(b.map(x => ({ ...x, id: Math.random().toString(36), isPaid: false })));
    setShowOnboarding(false);
  }} />;

  return (
    <div className="h-viewport w-full flex flex-col bg-slate-100 overflow-hidden relative">
      <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 justify-between pt-safe z-50">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 sm:hidden text-slate-900"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <h1 className="text-base font-black italic tracking-tighter">GBFinancer</h1>
        <button onClick={() => setIsProfileOpen(true)} className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-500 font-black flex items-center justify-center border-b-2 border-emerald-900 shadow-lg">{user.name.charAt(0)}</button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className={`fixed inset-y-0 left-0 z-[101] w-20 bg-slate-950 flex flex-col pt-16 transition-transform sm:relative sm:translate-x-0 sm:pt-6 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <nav className="flex flex-col gap-1 h-full overflow-y-auto no-scrollbar pb-10">
            <NavItem id="chat" label="Chat" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} />
            <NavItem id="dashboard" label="Painel" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/></svg>} />
            <NavItem id="simulator" label="Stress" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
            <NavItem id="transactions" label="Extrato" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/></svg>} />
            <NavItem id="goals" label="Metas" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>} />
            <NavItem id="score" label="Saúde" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} />
            <NavItem id="reminders" label="Lembretes" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
            <NavItem id="reports" label="Relatórios" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>} />
          </nav>
        </aside>

        <main className="flex-1 bg-[#f8fafc] relative overflow-hidden">
          {activeTab === 'chat' && <ChatInterface user={user} onTransactionDetected={t => setTransactions(p => [t, ...p])} onGoalOperation={handleGoalOperation} onGoalDetected={g => setGoals(p => [...p, { ...g, id: Math.random().toString(36), createdAt: new Date().toISOString(), currentAmount: 0, ativa: true, nivelEscada: 1, tipo: 'manual', prazoMeses: 12 }])} onBillDetected={b => setBills(p => [...p, { ...b, id: Math.random().toString(36), isPaid: false }])} transactions={transactions} budget={budget} categoryLimits={categoryLimits} goals={goals} notes={notes} messages={messages} setMessages={setMessages} categories={categories.map(c => c.name)} />}
          {activeTab === 'dashboard' && <Dashboard transactions={transactions} categoryLimits={categoryLimits} goals={goals} notes={notes} globalBudget={budget} onSetLimit={l => setCategoryLimits(p => [...p, l])} onRemoveLimit={cat => setCategoryLimits(p => p.filter(l => l.category !== cat))} onUpdateBudget={setBudget} />}
          {activeTab === 'simulator' && <ImpactSimulator transactions={transactions} goals={goals} />}
          {activeTab === 'transactions' && <TransactionList transactions={transactions} onDelete={id => setTransactions(p => p.filter(t => t.id !== id))} />}
          {activeTab === 'goals' && <Goals goals={goals} availableBalance={transactions.reduce((acc, t) => t.type === 'INCOME' ? acc + t.amount : acc - t.amount, 0)} onAddGoal={g => setGoals(p => [...p, { ...g, id: Math.random().toString(36), createdAt: new Date().toISOString(), ativa: true }])} onUpdateGoal={(id, upd) => setGoals(p => p.map(g => g.id === id ? {...g, ...upd} : g))} onDeleteGoal={id => setGoals(p => p.filter(g => g.id !== id))} transactions={transactions} userAssets={userAssets} onUpdateAssets={setUserAssets} />}
          {activeTab === 'score' && <HealthScoreTab transactions={transactions} goals={goals} onNavigateToGoals={() => setActiveTab('goals')} />}
          {activeTab === 'reports' && <Reports transactions={transactions} goals={goals} />}
          {activeTab === 'reminders' && <Reminders bills={bills} onToggleBill={handlePayBill} onDeleteBill={id => setBills(p => p.filter(b => b.id !== id))} onPayBill={handlePayBill} onAddBill={b => setBills(p => [...p, { ...b, id: Math.random().toString(36), isPaid: false }])} onUpdateBill={(id, upd) => setBills(p => p.map(b => b.id === id ? {...b, ...upd} : b))} />}
        </main>
      </div>
      {isProfileOpen && <ProfileModal user={user} onClose={() => setIsProfileOpen(false)} onUpdate={u => setUser({...user, ...u})} onLogout={() => { setUser(null); localStorage.clear(); window.location.reload(); }} />}
    </div>
  );
};

export default App;
