
import React, { useState } from 'react';
import { UserSession } from '../types';
import MoneyInput from './MoneyInput';
import { Notification } from './UI';

interface OnboardingProps {
  user: UserSession;
  onComplete: (data: { income: number; bills: any[]; goal: any }) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState<number>(0);
  const [bills, setBills] = useState<any[]>([]);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [billDesc, setBillDesc] = useState('');
  const [billVal, setBillVal] = useState('');
  const [billDay, setBillDay] = useState('');

  const handleAddBill = () => {
    if (billDesc && billVal && billDay) {
      const today = new Date();
      const dueDate = new Date(today.getFullYear(), today.getMonth(), parseInt(billDay)).toISOString();
      
      setBills([...bills, {
        description: billDesc,
        amount: parseFloat(billVal),
        dueDate: dueDate,
        dueDay: parseInt(billDay),
        recurring: true
      }]);
      setBillDesc('');
      setBillVal('');
      setBillDay('');
    }
  };

  const nextStep = () => setStep(prev => prev + 1);

  const finish = () => {
    onComplete({
      income,
      bills,
      goal: { name: goalName, targetAmount: parseFloat(goalTarget) || 0 }
    });
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[var(--bg-body)] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade">
      <div className="absolute inset-0 whatsapp-pattern opacity-10 pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-md bg-[var(--surface)] rounded-[2rem] shadow-2xl p-8 border border-[var(--border)]">
        {step === 0 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-[var(--green-whatsapp)] rounded-full flex items-center justify-center mx-auto shadow-lg text-white text-4xl font-black italic">GB</div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Olá, {user.name.split(' ')[0]}!</h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Sou seu novo Mentor Financeiro. Para começar a auditar seu dinheiro, preciso conhecer o básico do seu estilo de vida.
            </p>
            <button 
              onClick={nextStep}
              className="w-full bg-[var(--green-whatsapp)] text-white font-bold py-4 rounded-xl shadow-md active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Vamos começar →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
               <span className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest bg-[var(--green-whatsapp)]/10 px-3 py-1 rounded-full border border-[var(--green-whatsapp)]/20">Etapa 1: Receita</span>
               <h3 className="text-xl font-bold mt-4 text-[var(--text-primary)]">Qual sua renda mensal?</h3>
            </div>
            <div className="relative">
              <MoneyInput 
                autoFocus
                className="w-full bg-[var(--bg-body)] border border-[var(--border)] p-5 rounded-xl text-2xl font-black outline-none focus:border-[var(--green-whatsapp)] transition-all text-[var(--text-primary)]"
                placeholder="R$ 0,00"
                value={income}
                onChange={(val) => setIncome(val)}
              />
            </div>
            <button 
              onClick={() => {
                if (income > 0) {
                  nextStep();
                } else {
                  setNotification({ message: "Informe sua renda", type: 'error' });
                }
              }}
              className="w-full bg-[var(--text-primary)] text-[var(--bg-body)] font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Próximo: Gastos Fixos
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
               <span className="text-[10px] font-black text-[#ef4444] uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">Etapa 2: Compromissos</span>
               <h3 className="text-xl font-bold mt-4 text-[var(--text-primary)]">Quais seus gastos fixos?</h3>
            </div>
            
            <div className="bg-[var(--bg-body)] p-5 rounded-2xl space-y-3">
              <input 
                placeholder="Ex: Aluguel, Luz, Internet" 
                className="w-full bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl text-sm outline-none focus:border-[var(--green-whatsapp)] font-bold text-[var(--text-primary)]"
                value={billDesc} onChange={e => setBillDesc(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <MoneyInput 
                  placeholder="Valor R$" 
                  className="w-full bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl text-sm outline-none focus:border-[var(--green-whatsapp)] font-bold text-[var(--text-primary)]"
                  value={Number(billVal) || 0} 
                  onChange={val => setBillVal(val.toString())}
                />
                <input 
                  placeholder="Dia Venc." type="number" 
                  className="w-full bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl text-sm outline-none focus:border-[var(--green-whatsapp)] font-bold text-[var(--text-primary)]"
                  value={billDay} onChange={e => setBillDay(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAddBill}
                className="w-full bg-[var(--green-whatsapp)] text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                + Adicionar Gasto
              </button>
            </div>

            <div className="max-h-24 overflow-y-auto space-y-2 px-1">
              {bills.map((b, i) => (
                <div key={i} className="flex justify-between items-center bg-[var(--bg-body)] p-2 px-3 rounded-lg border border-[var(--border)] text-[11px] font-bold text-[var(--text-muted)]">
                  <span>{b.description} (Dia {b.dueDay})</span>
                  <span className="text-[#ef4444]">R$ {b.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={nextStep}
              className="w-full bg-[var(--text-primary)] text-[var(--bg-body)] font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              {bills.length === 0 ? 'Não tenho gastos fixos' : 'Próximo: Metas'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
               <span className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">Etapa 3: Sonhos</span>
               <h3 className="text-xl font-bold mt-4 text-[var(--text-primary)]">Qual seu maior objetivo?</h3>
               <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase mt-1 italic">Ex: Viagem, Carro, Reserva</p>
            </div>
            
            <div className="space-y-4">
              <input 
                className="w-full bg-[var(--bg-body)] border border-[var(--border)] p-5 rounded-xl text-sm font-black outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]"
                placeholder="Nome do Objetivo"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
              />
              <MoneyInput 
                className="w-full bg-[var(--bg-body)] border border-[var(--border)] p-5 rounded-xl text-sm font-black outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]"
                placeholder="Valor Alvo R$"
                value={Number(goalTarget) || 0}
                onChange={(val) => setGoalTarget(val.toString())}
              />
            </div>

            <button 
              onClick={finish}
              className="w-full bg-[var(--green-whatsapp)] text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Concluir Configuração →
            </button>
          </div>
        )}
      </div>

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default Onboarding;
