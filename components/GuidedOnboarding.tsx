
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  Target, 
  ShieldCheck, 
  MessageSquare,
  LayoutDashboard,
  Wallet,
  PieChart,
  X,
  Plus,
  Trash2,
  Info
} from 'lucide-react';
import { UserSession, OnboardingStatus, IncomeSource, IncomeProfile, Bill } from '../types';
import MoneyInput from './MoneyInput';
import { Notification } from './UI';

interface GuidedOnboardingProps {
  user: UserSession;
  onComplete: (data: any) => void;
  onUpdateStatus: (status: Partial<OnboardingStatus>) => void;
  onNavigateToTab: (tab: string) => void;
}

const GuidedOnboarding: React.FC<GuidedOnboardingProps> = ({ 
  user, 
  onComplete, 
  onUpdateStatus,
  onNavigateToTab 
}) => {
  const status = user.onboardingStatus || { step: 1, completed: false };
  const [currentStep, setCurrentStep] = useState(status.step || 1);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-unminimize when user responds in chat during step 3
  useEffect(() => {
    if (isMinimized && user.onboardingStatus?.chatContextResponded) {
      console.log("GB Onboarding: Resposta detectada no chat, restaurando overlay.");
      setIsMinimized(false);
    }
  }, [user.onboardingStatus?.chatContextResponded, isMinimized]);

  // Step 1: Income
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>(user.incomeProfile?.sources || []);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [newIncome, setNewIncome] = useState({
    description: '',
    amount: 0,
    frequency: 'MONTHLY' as any,
    wallet: '',
    dueDay: 5
  });

  // Step 2: Fixed Bills
  const [bills, setBills] = useState<Bill[]>([]);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [newBill, setNewBill] = useState({
    description: '',
    amount: 0,
    dueDay: new Date().getDate(),
    category: 'Contas Fixas',
    recurring: true
  });

  // Step 4: Spending Limits
  const [spendingLimit, setSpendingLimit] = useState(user.spendingLimit || 0);

  // Step 5: Goals
  const [goals, setGoals] = useState<any[]>(user.suggestedGoals || []);

  const totalSteps = 6;
  const progress = (currentStep / totalSteps) * 100;

  useEffect(() => {
    if (status.step !== currentStep) {
      onUpdateStatus({ step: currentStep });
    }
  }, [currentStep]);

  const handleNext = async () => {
    // Sincroniza dados parciais no Firestore para que o Chat (passo 3) tenha contexto real
    if (currentStep === 1) {
      // Validação Obrigatória Passo 1: Salário e Carteira
      const mainSource = incomeSources[0];
      if (!mainSource || !mainSource.amountExpected || mainSource.amountExpected <= 0 || !mainSource.targetWalletName) {
        setNotification({ message: "Por favor, informe seu salário e a carteira onde recebe.", type: 'error' });
        return;
      }

      const incomeProfile = { 
        occupationType: 'OTHER' as any,
        sources: incomeSources,
        totalExpectedMonthly: incomeSources.reduce((acc, s) => acc + (s.amountExpected || 0), 0)
      };
      
      await onUpdateStatus({ 
        incomeProfile,
        incomeCaptured: true
      } as any);

      // Criar lembretes de recebimento e carteiras imediatamente para o passo 3
      const { dispatchEvent } = await import('../services/eventDispatcher');
      for (const source of incomeSources) {
        // Criar carteira se informada
        if (source.targetWalletName) {
          await dispatchEvent(user.uid, {
            type: 'CREATE_WALLET',
            payload: { 
              name: source.targetWalletName, 
              balance: 0, 
              type: 'CHECKING' 
            },
            source: 'onboarding',
            createdAt: new Date()
          });
        }

        if (source.amountExpected && source.frequency !== 'VARIABLE') {
          const dueDay = source.dates && source.dates.length > 0 ? source.dates[0] : 1;
          await dispatchEvent(user.uid, {
            type: 'CREATE_REMINDER',
            payload: {
              description: `Recebimento: ${source.description}`,
              amount: source.amountExpected,
              dueDay: dueDay,
              category: 'Recebimento',
              type: 'RECEIVE',
              recurring: true,
              targetWalletName: source.targetWalletName,
              dedupeKey: `onboarding-income-${source.id}`
            },
            source: 'onboarding',
            createdAt: new Date()
          });
        }
      }
    }
    
    if (currentStep === 2) {
      await onUpdateStatus({ 
        billsProfile: { bills: bills },
        billsCaptured: true
      } as any);

      // Criar lembretes de contas fixas imediatamente
      const { dispatchEvent } = await import('../services/eventDispatcher');
      for (const bill of bills) {
        await dispatchEvent(user.uid, {
          type: 'CREATE_REMINDER',
          payload: { 
            description: bill.description, 
            amount: bill.amount, 
            dueDay: bill.dueDay, 
            category: 'Contas Fixas',
            type: 'PAY',
            recurring: true,
            dedupeKey: `onboarding-bill-${bill.id}`
          },
          source: 'onboarding',
          createdAt: new Date()
        });
      }
    }

    if (currentStep < totalSteps) {
      // Special check for Step 3 (Chat)
      if (currentStep === 3 && !user.onboardingStatus?.chatContextResponded) {
        setNotification({ message: "Responda ao chat antes de continuar!", type: 'error' });
        return;
      }

      // Save progress
      await onUpdateStatus({ step: (currentStep + 1) as any });

      setCurrentStep(currentStep + 1);
      
      // Special navigation for Step 3 (Chat)
      if (currentStep + 1 === 3) {
        onNavigateToTab('chat');
      }
    } else {
      // Final completion
      await onUpdateStatus({ completed: true });
      onComplete({
        incomeProfile: {
          occupationType: 'OTHER',
          sources: incomeSources,
          totalExpectedMonthly: incomeSources.reduce((acc, s) => acc + (s.amountExpected || 0), 0)
        },
        bills,
        spendingLimit,
        goals,
        onboardingSeen: true
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[#00A884]/10 text-[#00A884] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <DollarSign size={32} />
              </div>
              <h3 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter italic">Suas Entradas</h3>
              <p className="text-sm text-[#8696A0] leading-relaxed">
                Vamos começar entendendo como seu dinheiro entra. Isso permite organizar seu mês e prever recebimentos com precisão.
              </p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {incomeSources.map((s, idx) => (
                <div 
                  key={s.id || idx} 
                  onClick={() => {
                    setEditingIncomeId(s.id);
                    setNewIncome({
                      description: s.description,
                      amount: s.amountExpected || 0,
                      frequency: s.frequency || 'MONTHLY',
                      wallet: s.targetWalletName || '',
                      dueDay: s.dates && s.dates.length > 0 ? s.dates[0] : 5
                    } as any);
                    setShowIncomeForm(true);
                  }}
                  className="bg-[#202C33] p-4 rounded-2xl border border-[#2A3942]/40 flex justify-between items-center group animate-in fade-in slide-in-from-bottom-2 cursor-pointer hover:border-[#00A884]/50 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#00A884]/20 text-[#00A884] rounded-xl flex items-center justify-center">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#E9EDEF] uppercase">{s.description}</h4>
                      <p className="text-[9px] text-[#8696A0] font-bold uppercase">{s.targetWalletName || 'Carteira Principal'}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span className="text-xs font-black text-[#00A884]">R$ {s.amountExpected?.toFixed(2)}</span>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const itemToDelete = incomeSources[idx];
                        setIncomeSources(incomeSources.filter((_, i) => i !== idx));
                        
                        // Opcional: Deletar do Firestore se já foi criado
                        const { dispatchEvent } = await import('../services/eventDispatcher');
                        await dispatchEvent(user.uid, {
                          type: 'DELETE_REMINDER_BY_DEDUPE',
                          payload: { dedupeKey: `onboarding-income-${itemToDelete.id}` },
                          source: 'onboarding',
                          createdAt: new Date()
                        });
                      }} 
                      className="text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-rose-500/10 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {!showIncomeForm ? (
                <button 
                  onClick={() => {
                    setEditingIncomeId(null);
                    setNewIncome({ description: '', amount: 0, frequency: 'MONTHLY', wallet: '', dueDay: 5 });
                    setShowIncomeForm(true);
                  }}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-[#2A3942] text-[#8696A0] font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:border-[#00A884] hover:text-[#00A884] transition-all"
                >
                  <Plus size={16} /> Adicionar Renda
                </button>
              ) : (
                <div className="bg-[#202C33] p-5 rounded-3xl border border-[#00A884]/30 space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-[#00A884] uppercase tracking-widest">
                      {editingIncomeId ? 'Editar Renda' : 'Nova Renda'}
                    </h4>
                    {editingIncomeId && (
                      <button 
                        onClick={async () => {
                          const itemToDelete = incomeSources.find(s => s.id === editingIncomeId);
                          setIncomeSources(incomeSources.filter(s => s.id !== editingIncomeId));
                          setShowIncomeForm(false);
                          setEditingIncomeId(null);

                          if (itemToDelete) {
                            const { dispatchEvent } = await import('../services/eventDispatcher');
                            await dispatchEvent(user.uid, {
                              type: 'DELETE_REMINDER_BY_DEDUPE',
                              payload: { dedupeKey: `onboarding-income-${itemToDelete.id}` },
                              source: 'onboarding',
                              createdAt: new Date()
                            });
                          }
                        }}
                        className="text-rose-500 text-[9px] font-black uppercase flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Descrição</label>
                    <input 
                      placeholder="Ex: Salário, Freelance..."
                      className="w-full bg-[#111B21] p-3 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                      value={newIncome.description} onChange={e => setNewIncome({...newIncome, description: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Valor Mensal</label>
                    <MoneyInput 
                      className="w-full bg-[#111B21] p-3 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                      value={newIncome.amount} onChange={val => setNewIncome({...newIncome, amount: val})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Frequência</label>
                      <select 
                        className="w-full bg-[#111B21] p-3 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none appearance-none"
                        value={newIncome.frequency} onChange={e => setNewIncome({...newIncome, frequency: e.target.value as any})}
                      >
                        <option value="MONTHLY">Mensal</option>
                        <option value="BIWEEKLY">Quinzenal</option>
                        <option value="WEEKLY">Semanal</option>
                        <option value="VARIABLE">Variável</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Dia do Recebimento</label>
                      <input 
                        type="number" min="1" max="31"
                        placeholder="Ex: 5"
                        className="w-full bg-[#111B21] p-3 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                        value={(newIncome as any).dueDay || ''} 
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1 && val <= 31) {
                            setNewIncome({...newIncome, dueDay: val} as any);
                          } else if (e.target.value === '') {
                            setNewIncome({...newIncome, dueDay: undefined} as any);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Onde você recebe?</label>
                    <input 
                      placeholder="Ex: Nubank, Inter, Dinheiro..."
                      className="w-full bg-[#111B21] p-3 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                      value={newIncome.wallet} onChange={e => setNewIncome({...newIncome, wallet: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (!newIncome.description || newIncome.amount <= 0) return;
                        
                        const incomeData = {
                          id: editingIncomeId || Math.random().toString(36).substr(2, 9),
                          description: newIncome.description,
                          amountExpected: newIncome.amount,
                          frequency: newIncome.frequency || 'MONTHLY',
                          dates: (newIncome as any).dueDay ? [(newIncome as any).dueDay] : [],
                          targetWalletName: newIncome.wallet || 'Carteira Principal'
                        };

                        if (editingIncomeId) {
                          setIncomeSources(incomeSources.map(s => s.id === editingIncomeId ? incomeData : s));
                        } else {
                          setIncomeSources([...incomeSources, incomeData]);
                        }
                        
                        setNewIncome({ description: '', amount: 0, frequency: 'MONTHLY', wallet: '', dueDay: 5 });
                        setShowIncomeForm(false);
                        setEditingIncomeId(null);
                      }} 
                      className="flex-1 bg-[#00A884] text-white py-3 rounded-xl font-black text-[10px] uppercase"
                    >
                      {editingIncomeId ? 'Salvar Alterações' : 'Adicionar'}
                    </button>
                    <button 
                      onClick={() => {
                        setShowIncomeForm(false);
                        setEditingIncomeId(null);
                      }} 
                      className="flex-1 bg-[#111B21] text-[#8696A0] py-3 rounded-xl font-black text-[10px] uppercase"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} />
              </div>
              <h3 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter italic">Gastos Fixos</h3>
              <p className="text-sm text-[#8696A0] leading-relaxed">
                Agora, vamos listar o que você já sabe que precisa pagar todo mês. Isso ajuda a calcular quanto sobra de verdade.
              </p>
            </div>

            <div className="bg-[#202C33] p-5 rounded-3xl border border-[#2A3942]/40 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-[#00A884] uppercase tracking-widest">
                  {editingBillId ? 'Editar Gasto' : 'Novo Gasto'}
                </h4>
                {editingBillId && (
                  <button 
                    onClick={async () => {
                      const itemToDelete = bills.find(b => b.id === editingBillId);
                      setBills(bills.filter(b => b.id !== editingBillId));
                      setNewBill({ description: '', amount: 0, dueDay: new Date().getDate(), category: 'Contas Fixas', recurring: true });
                      setEditingBillId(null);

                      if (itemToDelete) {
                        const { dispatchEvent } = await import('../services/eventDispatcher');
                        await dispatchEvent(user.uid, {
                          type: 'DELETE_REMINDER_BY_DEDUPE',
                          payload: { dedupeKey: `onboarding-bill-${itemToDelete.id}` },
                          source: 'onboarding',
                          createdAt: new Date()
                        });
                      }
                    }}
                    className="text-rose-500 text-[9px] font-black uppercase flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Excluir
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Descrição</label>
                    <input 
                      placeholder="Ex: Aluguel, Luz..." 
                      className="w-full bg-[#111B21] p-3 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                      value={newBill.description} onChange={e => setNewBill({...newBill, description: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Categoria</label>
                    <select 
                      className="w-full bg-[#111B21] p-3 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none appearance-none"
                      value={newBill.category} onChange={e => setNewBill({...newBill, category: e.target.value})}
                    >
                      <option value="Contas Fixas">Contas Fixas</option>
                      <option value="Alimentação">Alimentação</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Lazer">Lazer</option>
                      <option value="Saúde">Saúde</option>
                      <option value="Educação">Educação</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Valor R$</label>
                    <MoneyInput 
                      placeholder="Valor R$" 
                      className="w-full bg-[#111B21] p-3 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                      value={newBill.amount} 
                      onChange={val => setNewBill({...newBill, amount: val})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Dia Venc.</label>
                    <input 
                      placeholder="Dia Venc." type="number" min="1" max="31"
                      className="w-full bg-[#111B21] p-3 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                      value={newBill.dueDay || ''} 
                      onChange={e => {
                        const val = e.target.value === '' ? '' : parseInt(e.target.value);
                        setNewBill({...newBill, dueDay: val as any});
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2">
                  <input 
                    type="checkbox" 
                    id="isRecurring"
                    checked={newBill.recurring}
                    onChange={e => setNewBill({...newBill, recurring: e.target.checked})}
                    className="w-4 h-4 accent-[#00A884]"
                  />
                  <label htmlFor="isRecurring" className="text-[10px] font-black text-[#8696A0] uppercase cursor-pointer">Gasto Fixo / Recorrente</label>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (!newBill.description || newBill.amount <= 0 || !newBill.dueDay) return;
                      
                      const billData = {
                        id: editingBillId || Math.random().toString(36).substr(2, 9),
                        description: newBill.description,
                        amount: newBill.amount,
                        dueDay: Number(newBill.dueDay),
                        type: 'PAY',
                        recurring: newBill.recurring,
                        category: newBill.category || 'Contas Fixas'
                      } as any;

                      if (editingBillId) {
                        setBills(bills.map(b => b.id === editingBillId ? billData : b));
                      } else {
                        setBills([...bills, billData]);
                      }
                      
                      setNewBill({ description: '', amount: 0, dueDay: new Date().getDate(), category: 'Contas Fixas', recurring: true });
                      setEditingBillId(null);
                    }}
                    className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#00A884] text-white shadow-lg active:scale-95 transition-all"
                  >
                    {editingBillId ? 'Salvar Alterações' : '+ Adicionar Gasto'}
                  </button>
                  {editingBillId && (
                    <button 
                      onClick={() => {
                        setNewBill({ description: '', amount: 0, dueDay: new Date().getDate(), category: 'Contas Fixas', recurring: true });
                        setEditingBillId(null);
                      }}
                      className="px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#111B21] text-[#8696A0]"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="max-h-24 overflow-y-auto space-y-2 px-1 custom-scrollbar">
              {bills.map((b, i) => (
                <div 
                  key={b.id || i} 
                  onClick={() => {
                    setEditingBillId(b.id);
                    setNewBill({
                      description: b.description,
                      amount: b.amount,
                      dueDay: b.dueDay,
                      category: b.category || 'Contas Fixas',
                      recurring: b.recurring !== undefined ? b.recurring : true
                    });
                  }}
                  className="flex justify-between items-center bg-[#202C33] p-3 rounded-xl border border-[#2A3942]/20 cursor-pointer hover:border-[#00A884]/50 transition-all active:scale-[0.98] group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${b.recurring ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                    <div>
                      <span className="text-xs font-black text-[#E9EDEF] uppercase block">{b.description}</span>
                      <span className="text-[8px] font-bold text-[#8696A0] uppercase">{b.category} • {b.recurring ? 'Fixo' : 'Variável'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-rose-500">R$ {b.amount.toFixed(2)}</span>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const itemToDelete = bills[i];
                        setBills(bills.filter((_, idx) => idx !== i));

                        const { dispatchEvent } = await import('../services/eventDispatcher');
                        await dispatchEvent(user.uid, {
                          type: 'DELETE_REMINDER_BY_DEDUPE',
                          payload: { dedupeKey: `onboarding-bill-${itemToDelete.id}` },
                          source: 'onboarding',
                          createdAt: new Date()
                        });
                      }}
                      className="text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-rose-500/10 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-[#00A884]/10 text-[#00A884] rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-[#00A884]/20 animate-pulse">
              <MessageSquare size={40} />
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter italic">Inteligência Conversacional</h3>
              <p className="text-sm text-[#8696A0] leading-relaxed">
                O <span className="text-[#00A884] font-black">GBFinancer</span> não é apenas uma planilha. É um assistente que conversa com você.
              </p>
              
              {!user.onboardingStatus?.chatContextResponded ? (
                <div className="bg-[#202C33] p-6 rounded-3xl border-2 border-dashed border-[#00A884]/40 text-center space-y-4 animate-pulse">
                  <p className="text-xs text-[#E9EDEF] font-black uppercase italic">Vá para o chat e responda à pergunta do Assistente GB!</p>
                  <button 
                    onClick={() => {
                      console.log("GB Onboarding: Navegando para o chat e minimizando onboarding.");
                      onNavigateToTab('chat');
                      setIsMinimized(true);
                    }}
                    className="bg-[#00A884] text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-all active:scale-95"
                  >
                    Ir para o Chat
                  </button>
                </div>
              ) : (
                <div className="bg-[#00A884]/10 p-6 rounded-3xl border-2 border-[#00A884] text-center space-y-4">
                  <div className="w-10 h-10 bg-[#00A884] rounded-full flex items-center justify-center mx-auto text-white">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-xs text-[#E9EDEF] font-black uppercase italic">Excelente! Você interagiu com o sistema. Clique em continuar.</p>
                </div>
              )}
              
              <p className="text-[10px] text-[#8696A0] font-medium italic">
                * O tour continuará assim que você responder no chat.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <PieChart size={32} />
              </div>
              <h3 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter italic">Limites de Gastos</h3>
              <p className="text-sm text-[#8696A0] leading-relaxed">
                Definir um limite ajuda a manter o controle. O sistema te avisará quando você estiver chegando perto do teto.
              </p>
            </div>

            <div className="bg-[#202C33] p-8 rounded-[2.5rem] border border-[#2A3942]/40 space-y-6 text-center">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#8696A0] uppercase tracking-widest">Limite Mensal Sugerido</label>
                <div className="text-4xl font-black text-[#00A884] italic tracking-tighter">
                  R$ {spendingLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              
              <input 
                type="range" 
                min="0" 
                max={incomeSources.reduce((acc, s) => acc + (s.amountExpected || 0), 0) || 5000} 
                step="100"
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(parseInt(e.target.value))}
                className="w-full h-2 bg-[#111B21] rounded-lg appearance-none cursor-pointer accent-[#00A884]"
              />
              
              <div className="flex justify-between text-[10px] font-black text-[#8696A0] uppercase">
                <span>R$ 0</span>
                <span>R$ {(incomeSources.reduce((acc, s) => acc + (s.amountExpected || 0), 0) || 5000).toLocaleString()}</span>
              </div>

              <div className="bg-[#111B21] p-4 rounded-2xl flex items-center gap-3 text-left border border-[#00A884]/10">
                <Info className="text-[#00A884] shrink-0" size={18} />
                <p className="text-[10px] text-[#8696A0] font-medium leading-tight">
                  Recomendamos não comprometer mais de 70% da sua renda com gastos variáveis.
                </p>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Target size={32} />
              </div>
              <h3 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter italic">Suas Metas</h3>
              <p className="text-sm text-[#8696A0] leading-relaxed">
                Para onde vai o que sobra? Definir metas dá propósito ao seu esforço de economizar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'reserva', label: 'Reserva de Emergência', icon: '🛡️', color: 'bg-blue-500' },
                { id: 'viagem', label: 'Viagem dos Sonhos', icon: '✈️', color: 'bg-purple-500' },
                { id: 'carro', label: 'Trocar de Carro', icon: '🚗', color: 'bg-amber-500' },
                { id: 'casa', label: 'Casa Própria', icon: '🏠', color: 'bg-emerald-500' }
              ].map(goal => (
                <button
                  key={goal.id}
                  onClick={() => {
                    if (goals.find(g => g.id === goal.id)) {
                      setGoals(goals.filter(g => g.id !== goal.id));
                    } else {
                      setGoals([...goals, { ...goal, targetAmount: 1000, currentAmount: 0 }]);
                    }
                  }}
                  className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                    goals.find(g => g.id === goal.id)
                      ? 'bg-[#00A884]/10 border-[#00A884] shadow-lg'
                      : 'bg-[#202C33] border-transparent hover:border-[#2A3942]'
                  }`}
                >
                  <span className="text-2xl">{goal.icon}</span>
                  <span className="text-[10px] font-black text-[#E9EDEF] uppercase leading-tight">{goal.label}</span>
                </button>
              ))}
            </div>

            <div className="bg-[#111B21] p-4 rounded-2xl flex items-center gap-3 border border-blue-500/10">
              <CheckCircle2 className="text-blue-500 shrink-0" size={18} />
              <p className="text-[10px] text-[#8696A0] font-medium leading-tight">
                Você selecionou {goals.length} metas. Vamos te ajudar a alcançá-las!
              </p>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-[#00A884] rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl text-white text-4xl font-black italic transform -rotate-6 mb-6">GB</div>
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter italic">Pronto para Decolar!</h3>
              <p className="text-sm text-[#8696A0] leading-relaxed">
                Você concluiu a configuração básica. Agora o <span className="text-[#00A884] font-black">GBFinancer</span> está pronto para ser seu braço direito financeiro.
              </p>
              
              <div className="grid grid-cols-3 gap-2 py-4">
                <div className="space-y-1">
                  <div className="w-10 h-10 bg-[#202C33] rounded-xl flex items-center justify-center mx-auto text-[#8696A0]">
                    <LayoutDashboard size={20} />
                  </div>
                  <span className="text-[8px] font-black text-[#8696A0] uppercase">Dashboard</span>
                </div>
                <div className="space-y-1">
                  <div className="w-10 h-10 bg-[#202C33] rounded-xl flex items-center justify-center mx-auto text-[#8696A0]">
                    <Wallet size={20} />
                  </div>
                  <span className="text-[8px] font-black text-[#8696A0] uppercase">Carteiras</span>
                </div>
                <div className="space-y-1">
                  <div className="w-10 h-10 bg-[#202C33] rounded-xl flex items-center justify-center mx-auto text-[#8696A0]">
                    <PieChart size={20} />
                  </div>
                  <span className="text-[8px] font-black text-[#8696A0] uppercase">Análises</span>
                </div>
              </div>

              <p className="text-xs text-[#8696A0] italic">
                "O sucesso financeiro não é sobre quanto você ganha, mas sobre como você gerencia."
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
        <motion.div 
          key="minimized"
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          className="fixed bottom-6 right-6 z-[10001]"
        >
          <button 
            onClick={() => setIsMinimized(false)}
            className="bg-[#00A884] text-white p-4 rounded-full shadow-2xl flex items-center gap-3 border-2 border-white/20 hover:scale-105 transition-all group"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <MessageSquare size={18} />
            </div>
            <div className="text-left pr-2">
              <p className="text-[8px] font-black uppercase opacity-70">Onboarding Ativo</p>
              <p className="text-[10px] font-black uppercase italic">Passo {currentStep} de {totalSteps}</p>
            </div>
          </button>
        </motion.div>
      ) : (
        <motion.div 
          key="full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-[#0B141A]/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="absolute inset-0 whatsapp-pattern opacity-[0.05] pointer-events-none"></div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative z-10 w-full max-w-md bg-[#111B21] rounded-[3rem] shadow-2xl p-8 border border-[#2A3942]/60 flex flex-col min-h-[550px]"
          >
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-[#202C33] rounded-full mb-8 overflow-hidden">
              <motion.div 
                className="h-full bg-[#00A884] shadow-[0_0_15px_rgba(0,168,132,0.6)]" 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>

            {/* Header Info */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-black text-[#00A884] uppercase tracking-widest bg-[#00A884]/10 px-3 py-1 rounded-full border border-[#00A884]/20">
                Passo {currentStep} de {totalSteps}
              </span>
              <button 
                onClick={() => onComplete({ onboardingSeen: true })}
                className="text-[#8696A0] hover:text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
              >
                Pular <X size={14} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 flex flex-col justify-center"
                >
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer Navigation */}
            <div className="mt-8 flex gap-3">
              {currentStep > 1 && (
                <button 
                  onClick={handleBack}
                  className="px-6 bg-[#202C33] text-[#8696A0] font-black py-5 rounded-2xl hover:bg-[#2A3942] transition-all uppercase tracking-widest text-[10px] flex items-center justify-center"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <button 
                onClick={handleNext}
                className="flex-1 bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
              >
                {currentStep === totalSteps ? 'Começar Agora' : 'Continuar'} 
                <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {notification && (
        <div className="fixed top-4 right-4 z-[10002]">
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        </div>
      )}
    </AnimatePresence>
  );
};

export default GuidedOnboarding;
