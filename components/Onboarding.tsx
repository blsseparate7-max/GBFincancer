
import React, { useState } from 'react';
import { UserSession, Bill } from '../types';

interface OnboardingProps {
  user: UserSession;
  onComplete: (data: { income: number; bills: Omit<Bill, 'id' | 'isPaid'>[] }) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState<number>(0);
  const [bills, setBills] = useState<Omit<Bill, 'id' | 'isPaid'>[]>([]);
  
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
        isRecurring: true,
        remindersEnabled: true,
        frequency: 'MONTHLY'
      }]);
      setBillDesc('');
      setBillVal('');
      setBillDay('');
    }
  };

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="fixed inset-0 z-[3000] bg-[#f0f2f5] flex items-center justify-center p-6 text-slate-900 animate-in fade-in duration-500 overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none whatsapp-pattern"></div>
      
      <div className="relative z-10 w-full max-w-md">
        {step === 0 && (
          <div className="space-y-8 animate-in slide-in-from-bottom text-center bg-white p-10 rounded-[3rem] shadow-2xl">
            <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl text-3xl font-black text-emerald-500 italic">GB</div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-tight text-slate-900">
              Inicie sua Jornada
            </h2>
            <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
              Olá {user.name.split(' ')[0]}, sou o GB. Para auditar suas finanças com precisão, preciso de 3 informações básicas.
            </p>
            <button 
              onClick={() => setStep(1)}
              className="w-full bg-[#00a884] text-white font-black py-5 rounded-[2rem] shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Começar Diagnóstico →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right bg-white p-10 rounded-[3rem] shadow-2xl">
            <div className="flex items-center justify-center mb-2">
               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">Receita Base</span>
            </div>
            <h3 className="text-2xl font-bold text-center text-slate-800 tracking-tight">Qual sua renda mensal livre hoje?</h3>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl">R$</span>
              <input 
                type="number" 
                autoFocus
                className="w-full bg-slate-50 border-2 border-slate-100 p-6 pl-14 rounded-[2rem] text-3xl font-black outline-none focus:border-emerald-500 transition-all text-slate-900"
                placeholder="0,00"
                onChange={(e) => setIncome(parseFloat(e.target.value))}
              />
            </div>
            <button 
              onClick={() => income > 0 ? setStep(2) : alert("Por favor, informe um valor.")}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Próximo: Contas Fixas
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right bg-white p-10 rounded-[3rem] shadow-2xl">
            <div className="flex items-center justify-center mb-2">
               <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full">Compromissos</span>
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800">Liste seus gastos fixos mensais</h3>
            
            <div className="bg-slate-50 p-6 rounded-[2.5rem] space-y-3">
              <input 
                placeholder="Ex: Aluguel, Luz, Internet" 
                className="w-full bg-white border border-slate-100 p-3.5 rounded-xl text-sm outline-none focus:border-emerald-500 font-bold text-slate-900 shadow-sm"
                value={billDesc} onChange={e => setBillDesc(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input 
                  placeholder="Valor R$" type="number" 
                  className="w-full bg-white border border-slate-100 p-3.5 rounded-xl text-sm outline-none focus:border-emerald-500 font-bold text-slate-900 shadow-sm"
                  value={billVal} onChange={e => setBillVal(e.target.value)}
                />
                <input 
                  placeholder="Dia Venc." type="number" 
                  className="w-full bg-white border border-slate-100 p-3.5 rounded-xl text-sm outline-none focus:border-emerald-500 font-bold text-slate-900 shadow-sm"
                  value={billDay} onChange={e => setBillDay(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAddBill}
                className="w-full bg-emerald-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
              >
                + Adicionar Gasto
              </button>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-2 no-scrollbar px-1">
              {bills.map((b, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100 animate-in fade-in">
                  <span className="text-[10px] font-bold text-slate-600">{b.description} (Dia {new Date(b.dueDate).getDate()})</span>
                  <span className="text-[10px] font-black text-rose-500">{currencyFormatter.format(b.amount)}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => onComplete({ income, bills })}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-xs"
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
