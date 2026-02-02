
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
      // Define o vencimento para o dia escolhido no mês atual
      const dueDate = new Date(today.getFullYear(), today.getMonth(), parseInt(billDay)).toISOString();
      
      setBills([...bills, {
        description: billDesc,
        amount: parseFloat(billVal),
        dueDate: dueDate,
        isRecurring: true, // Força recorrência para ir para Lembretes
        remindersEnabled: true,
        frequency: 'MONTHLY' // Ciclo de 30 dias (mensal)
      }]);
      setBillDesc('');
      setBillVal('');
      setBillDay('');
    }
  };

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950 flex items-center justify-center p-6 text-white animate-in fade-in duration-500 overflow-y-auto">
      <div className="absolute inset-0 opacity-10 pointer-events-none whatsapp-bg"></div>
      
      <div className="relative z-10 w-full max-w-sm text-center">
        {step === 0 && (
          <div className="space-y-8 animate-in slide-in-from-bottom">
            <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl text-4xl">🛡️</div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-tight">
              Olá, {user.name.split(' ')[0]}!
            </h2>
            <p className="text-sm font-medium text-slate-400 leading-relaxed">
              Sou o GB, seu assistente de elite. Vamos configurar sua estrutura base de gastos fixos para automação de 30 dias.
            </p>
            <button 
              onClick={() => setStep(1)}
              className="w-full bg-white text-slate-950 font-black py-5 rounded-[2rem] shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
            >
              Iniciar Diagnóstico →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Passo 1: Receita</p>
            <h3 className="text-2xl font-black italic tracking-tighter uppercase">Qual sua receita mensal livre?</h3>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-black">R$</span>
              <input 
                type="number" 
                autoFocus
                className="w-full bg-white/10 border-2 border-white/20 p-6 pl-14 rounded-[2rem] text-2xl font-black outline-none focus:border-emerald-500 transition-all text-white"
                placeholder="0,00"
                onChange={(e) => setIncome(parseFloat(e.target.value))}
              />
            </div>
            <button 
              onClick={() => income > 0 ? setStep(2) : alert("Insira um valor.")}
              className="w-full bg-emerald-500 text-white font-black py-5 rounded-[2rem] shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
            >
              Próximo: Gastos Fixos
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Passo 2: Custos Fixos</p>
            <h3 className="text-xl font-black italic tracking-tighter uppercase text-left">Cadastre seus gastos fixos (Internet, Aluguel, etc)</h3>
            
            <div className="bg-white/5 p-5 rounded-[2.5rem] border border-white/10 space-y-3">
              <input 
                placeholder="Descrição" 
                className="w-full bg-transparent border-b border-white/20 p-2 text-sm outline-none focus:border-emerald-500 font-bold text-white"
                value={billDesc} onChange={e => setBillDesc(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <input 
                  placeholder="Valor R$" type="number" 
                  className="w-full bg-transparent border-b border-white/20 p-2 text-sm outline-none focus:border-emerald-500 font-bold text-white"
                  value={billVal} onChange={e => setBillVal(e.target.value)}
                />
                <input 
                  placeholder="Dia Venc." type="number" 
                  className="w-full bg-transparent border-b border-white/20 p-2 text-sm outline-none focus:border-emerald-500 font-bold text-white"
                  value={billDay} onChange={e => setBillDay(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAddBill}
                className="w-full bg-white text-slate-900 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest"
              >
                + Adicionar Gasto Fixo
              </button>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-2 no-scrollbar">
              {bills.map((b, i) => (
                <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 animate-in fade-in">
                  <span className="text-[9px] font-black uppercase">{b.description} (Dia {new Date(b.dueDate).getDate()})</span>
                  <span className="text-[9px] font-black text-emerald-400">{currencyFormatter.format(b.amount)}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => onComplete({ income, bills })}
              className="w-full bg-emerald-500 text-white font-black py-5 rounded-[2.5rem] shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
            >
              Finalizar Diagnóstico
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
