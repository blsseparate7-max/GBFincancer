
import React, { useState } from 'react';
import { UserSession } from '../types';

interface SetupWizardProps {
  user: UserSession;
  onComplete: (data: { income: number; bills: any[]; goal: any }) => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ user, onComplete }) => {
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
    <div className="fixed inset-0 z-[5000] bg-[#0B141A] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade">
      <div className="absolute inset-0 whatsapp-pattern opacity-[0.03] pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-md bg-[#111B21] rounded-[2.5rem] shadow-2xl p-8 border border-[#2A3942]/60">
        {step === 0 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-[#00A884] rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl text-white text-4xl font-black italic">GB</div>
            <h2 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter">Olá, {user.name.split(' ')[0]}!</h2>
            <p className="text-sm text-[#8696A0] leading-relaxed">
              Agora que você já sabe como eu funciono, vamos configurar o básico para começar a auditar seu dinheiro.
            </p>
            <button 
              onClick={nextStep}
              className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
            >
              Configurar dados iniciais →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
               <span className="text-[10px] font-black text-[#00A884] uppercase tracking-widest bg-[#00A884]/10 px-3 py-1 rounded-full border border-[#00A884]/20">Etapa 1: Receita</span>
               <h3 className="text-xl font-black mt-4 text-[#E9EDEF]">Qual sua renda mensal?</h3>
            </div>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[#8696A0] font-black text-xl">R$</span>
              <input 
                type="number" 
                autoFocus
                className="w-full bg-[#202C33] border border-transparent p-6 pl-14 rounded-2xl text-2xl font-black outline-none focus:border-[#00A884] transition-all text-[#E9EDEF]"
                placeholder="0,00"
                value={income || ''}
                onChange={(e) => setIncome(parseFloat(e.target.value))}
              />
            </div>
            <button 
              onClick={() => income > 0 ? nextStep() : alert("Informe sua renda")}
              className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
            >
              Próximo: Gastos Fixos
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
               <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">Etapa 2: Compromissos</span>
               <h3 className="text-xl font-black mt-4 text-[#E9EDEF]">Quais seus gastos fixos?</h3>
            </div>
            
            <div className="bg-[#202C33] p-5 rounded-[2rem] space-y-3">
              <input 
                placeholder="Ex: Aluguel, Luz, Internet" 
                className="w-full bg-[#111B21] border border-[#2A3942]/40 p-4 rounded-xl text-sm outline-none focus:border-[#00A884] font-bold text-[#E9EDEF]"
                value={billDesc} onChange={e => setBillDesc(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input 
                  placeholder="Valor R$" type="number" 
                  className="w-full bg-[#111B21] border border-[#2A3942]/40 p-4 rounded-xl text-sm outline-none focus:border-[#00A884] font-bold text-[#E9EDEF]"
                  value={billVal} onChange={e => setBillVal(e.target.value)}
                />
                <input 
                  placeholder="Dia Venc." type="number" 
                  className="w-full bg-[#111B21] border border-[#2A3942]/40 p-4 rounded-xl text-sm outline-none focus:border-[#00A884] font-bold text-[#E9EDEF]"
                  value={billDay} onChange={e => setBillDay(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAddBill}
                className="w-full bg-[#00A884]/20 text-[#00A884] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#00A884]/30"
              >
                + Adicionar Gasto
              </button>
            </div>

            <div className="max-h-24 overflow-y-auto space-y-2 no-scrollbar px-1">
              {bills.map((b, i) => (
                <div key={i} className="flex justify-between items-center bg-[#202C33] p-3 rounded-xl border border-[#2A3942]/20 text-[11px] font-bold text-[#8696A0]">
                  <span>{b.description} (Dia {b.dueDay})</span>
                  <span className="text-rose-500 font-black">R$ {b.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={nextStep}
              className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
            >
              {bills.length === 0 ? 'Não tenho gastos fixos' : 'Próximo: Metas'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
               <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/20">Etapa 3: Sonhos</span>
               <h3 className="text-xl font-black mt-4 text-[#E9EDEF]">Qual seu maior objetivo?</h3>
               <p className="text-[10px] text-[#8696A0] font-black uppercase mt-1 italic tracking-widest">Ex: Viagem, Carro, Reserva</p>
            </div>
            
            <div className="space-y-4">
              <input 
                className="w-full bg-[#202C33] border border-transparent p-6 rounded-2xl text-sm font-black outline-none focus:border-[#00A884] text-[#E9EDEF] transition-all"
                placeholder="Nome do Objetivo"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
              />
              <input 
                type="number"
                className="w-full bg-[#202C33] border border-transparent p-6 rounded-2xl text-sm font-black outline-none focus:border-[#00A884] text-[#E9EDEF] transition-all"
                placeholder="Valor Alvo R$"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
              />
            </div>

            <button 
              onClick={finish}
              className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
            >
              Concluir Configuração →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
