
import React, { useState } from 'react';
import { UserSession } from '../types';

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
    <div className="fixed inset-0 z-[5000] bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade">
      <div className="absolute inset-0 whatsapp-pattern opacity-10 pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 border border-[#d1d7db]">
        {step === 0 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-[#25D366] rounded-full flex items-center justify-center mx-auto shadow-lg text-white text-4xl font-black italic">GB</div>
            <h2 className="text-2xl font-black text-[#111b21] uppercase tracking-tighter">Olá, {user.name.split(' ')[0]}!</h2>
            <p className="text-sm text-[#667781] leading-relaxed">
              Sou seu novo Mentor Financeiro. Para começar a auditar seu dinheiro, preciso conhecer o básico do seu estilo de vida.
            </p>
            <button 
              onClick={nextStep}
              className="w-full bg-[#00a884] text-white font-bold py-4 rounded-xl shadow-md active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Vamos começar →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
               <span className="text-[10px] font-black text-[#00a884] uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Etapa 1: Receita</span>
               <h3 className="text-xl font-bold mt-4 text-[#111b21]">Qual sua renda mensal?</h3>
            </div>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#667781] font-bold text-lg">R$</span>
              <input 
                type="number" 
                autoFocus
                className="w-full bg-[#f0f2f5] border border-transparent p-5 pl-12 rounded-xl text-2xl font-black outline-none focus:border-[#00a884] transition-all text-[#111b21]"
                placeholder="0,00"
                value={income || ''}
                onChange={(e) => setIncome(parseFloat(e.target.value))}
              />
            </div>
            <button 
              onClick={() => income > 0 ? nextStep() : alert("Informe sua renda")}
              className="w-full bg-[#111b21] text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Próximo: Gastos Fixos
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
               <span className="text-[10px] font-black text-[#ef4444] uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full border border-red-100">Etapa 2: Compromissos</span>
               <h3 className="text-xl font-bold mt-4 text-[#111b21]">Quais seus gastos fixos?</h3>
            </div>
            
            <div className="bg-[#f0f2f5] p-5 rounded-2xl space-y-3">
              <input 
                placeholder="Ex: Aluguel, Luz, Internet" 
                className="w-full bg-white border border-[#d1d7db] p-3 rounded-xl text-sm outline-none focus:border-[#00a884] font-bold"
                value={billDesc} onChange={e => setBillDesc(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input 
                  placeholder="Valor R$" type="number" 
                  className="w-full bg-white border border-[#d1d7db] p-3 rounded-xl text-sm outline-none focus:border-[#00a884] font-bold"
                  value={billVal} onChange={e => setBillVal(e.target.value)}
                />
                <input 
                  placeholder="Dia Venc." type="number" 
                  className="w-full bg-white border border-[#d1d7db] p-3 rounded-xl text-sm outline-none focus:border-[#00a884] font-bold"
                  value={billDay} onChange={e => setBillDay(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAddBill}
                className="w-full bg-[#00a884] text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                + Adicionar Gasto
              </button>
            </div>

            <div className="max-h-24 overflow-y-auto space-y-2 no-scrollbar px-1">
              {bills.map((b, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 p-2 px-3 rounded-lg border border-gray-100 text-[11px] font-bold text-[#667781]">
                  <span>{b.description} (Dia {b.dueDay})</span>
                  <span className="text-[#ef4444]">R$ {b.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={nextStep}
              className="w-full bg-[#111b21] text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              {bills.length === 0 ? 'Não tenho gastos fixos' : 'Próximo: Metas'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
               <span className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Etapa 3: Sonhos</span>
               <h3 className="text-xl font-bold mt-4 text-[#111b21]">Qual seu maior objetivo?</h3>
               <p className="text-[10px] text-[#667781] font-bold uppercase mt-1 italic">Ex: Viagem, Carro, Reserva</p>
            </div>
            
            <div className="space-y-4">
              <input 
                className="w-full bg-[#f0f2f5] border border-[#d1d7db] p-5 rounded-xl text-sm font-black outline-none focus:border-[#00a884] text-[#111b21]"
                placeholder="Nome do Objetivo"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
              />
              <input 
                type="number"
                className="w-full bg-[#f0f2f5] border border-[#d1d7db] p-5 rounded-xl text-sm font-black outline-none focus:border-[#00a884] text-[#111b21]"
                placeholder="Valor Alvo R$"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
              />
            </div>

            <button 
              onClick={finish}
              className="w-full bg-[#00a884] text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Concluir Configuração →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
