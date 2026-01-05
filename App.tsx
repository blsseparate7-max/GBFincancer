
import React, { useState, useEffect, useMemo } from 'react';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import Goals from './components/Goals';
import Auth from './components/Auth';
import AdminPanel from './components/AdminPanel';
import { Transaction, CategoryLimit, SavingGoal, UserSession, CustomerData } from './types';
import { getGoalAdvice } from './services/geminiService';
import { syncUserData } from './services/databaseService';

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'goals' | 'dashboard' | 'database' | 'admin'>('chat');
  const [notification, setNotification] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'syncing' | 'success'>('idle');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<number>(2000);
  const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>([]);
  const [goals, setGoals] = useState<SavingGoal[]>([]);

  // Carrega Clientes para o Admin (Simulação SaaS)
  const allCustomers = useMemo(() => {
    if (user?.role !== 'ADMIN') return [];
    const customers: CustomerData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('finai_user_')) {
        const userId = key.replace('finai_user_', '');
        const userInfo = JSON.parse(localStorage.getItem(key) || '{}');
        const userData = JSON.parse(localStorage.getItem(`finai_data_${userId}`) || '{"transactions":[], "goals":[]}');
        if (userId !== 'ADMIN') customers.push({ ...userInfo, userId, userName: userInfo.name, ...userData });
      }
    }
    return customers;
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'USER') {
      const dataKey = `finai_data_${user.id}`;
      const saved = localStorage.getItem(dataKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTransactions(parsed.transactions || []);
        setGoals(parsed.goals || []);
      }
    }
  }, [user]);

  // Sincronização Inteligente (Cloud Sync)
  useEffect(() => {
    if (user && user.role === 'USER') {
      const dataKey = `finai_data_${user.id}`;
      const data = { transactions, budget, categoryLimits, goals };
      localStorage.setItem(dataKey, JSON.stringify(data));
      
      setCloudStatus('syncing');
      syncUserData(user.id, data).then(() => {
        setCloudStatus('success');
        setTimeout(() => setCloudStatus('idle'), 2000);
      });
    }
  }, [transactions, budget, categoryLimits, goals, user]);

  const handleTransactionDetected = (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
    if (transaction.type === 'SAVING' && goals.length > 0) {
      const perGoal = transaction.amount / goals.length;
      setGoals(prev => prev.map(g => ({...g, currentAmount: g.currentAmount + perGoal})));
    }
  };

  const handleAddGoal = async (g: any) => {
    const newGoal: SavingGoal = {
      ...g, id: Math.random().toString(36).substring(7),
      currentAmount: 0, createdAt: new Date().toISOString()
    };
    const advice = await getGoalAdvice(newGoal);
    setGoals(prev => [...prev, { ...newGoal, advice }]);
    setNotification(`Meta "${g.name}" criada com sucesso!`);
    setTimeout(() => setNotification(null), 3000);
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-0 sm:p-4">
        <div className="w-full max-w-md h-[100vh] sm:h-[90vh] bg-white shadow-2xl overflow-hidden sm:rounded-[3rem]">
          <Auth onLogin={(u) => { setUser(u); if(u.role === 'ADMIN') setActiveTab('admin'); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#ece5dd] font-sans p-0 sm:p-4">
      <div className="w-full max-w-md h-[100vh] sm:h-[90vh] bg-white shadow-2xl flex flex-col overflow-hidden sm:rounded-[2.5rem] relative">
        
        {/* Cloud Status Indicator */}
        <div className="absolute top-4 right-6 z-[100] flex items-center gap-2">
           {cloudStatus === 'syncing' && <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>}
           {cloudStatus === 'success' && <div className="w-2 h-2 bg-emerald-500 rounded-full scale-125 transition-all"></div>}
           <span className="text-[7px] font-black uppercase tracking-widest text-white/40">
             {cloudStatus === 'syncing' ? 'Syncing...' : cloudStatus === 'success' ? 'Cloud Saved' : ''}
           </span>
        </div>

        <div className="bg-[#075e54] text-white pt-10 pb-4 px-6 z-20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 overflow-hidden shadow-inner">
                 <img src={`https://api.dicebear.com/7.x/${user.role === 'ADMIN' ? 'bottts' : 'avataaars'}/svg?seed=${user.id}`} alt="User" className="w-full h-full" />
              </div>
              <div>
                <h1 className="font-black text-lg leading-none tracking-tight">{user.role === 'ADMIN' ? 'GBFinancer Admin' : 'Meu GBFinancer'}</h1>
                <p className="text-[9px] font-black uppercase opacity-60 tracking-widest mt-1">Status: Ativo • {user.plan}</p>
              </div>
            </div>
            <button onClick={() => setUser(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors opacity-60">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>

          <nav className="flex gap-4 font-black text-[10px] uppercase tracking-widest overflow-x-auto no-scrollbar">
            {user.role === 'ADMIN' ? (
              <button className="py-2 border-b-2 border-white">Dashboard de Gestão</button>
            ) : (
              ['chat', 'goals', 'dashboard', 'database'].map(t => (
                <button 
                  key={t} onClick={() => setActiveTab(t as any)}
                  className={`py-2 border-b-2 transition-all shrink-0 ${activeTab === t ? 'border-white text-white' : 'border-transparent text-white/40'}`}
                >
                  {t}
                </button>
              ))
            )}
          </nav>
        </div>

        <main className="flex-1 overflow-hidden relative bg-[#f0f2f5]">
          {user.role === 'ADMIN' ? (
            <AdminPanel customers={allCustomers} />
          ) : (
            <>
              {activeTab === 'chat' && <ChatInterface transactions={transactions} onTransactionDetected={handleTransactionDetected} onGoalDetected={handleAddGoal} budget={budget} categoryLimits={categoryLimits} />}
              {activeTab === 'goals' && <Goals goals={goals} onAddGoal={handleAddGoal} />}
              {activeTab === 'dashboard' && <Dashboard transactions={transactions} budget={budget} categoryLimits={categoryLimits} onUpdateBudget={setBudget} />}
              {activeTab === 'database' && <TransactionList transactions={transactions} onDelete={(id) => setTransactions(t => t.filter(x => x.id !== id))} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
