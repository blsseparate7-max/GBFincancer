
import React, { useState } from 'react';
import { UserSession } from '../types';
import MoneyInput from './MoneyInput';

interface SetupWizardProps {
  user: UserSession;
  onComplete: (data: { income: number; bills: any[]; goal: any }) => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState<number>(0);
  const [bills, setBills] = useState<any[]>([]);
  
  const [billDesc, setBillDesc] = useState('');
  const [billVal, setBillVal] = useState('');
  const [billDay, setBillDay] = useState('');
  const [billType, setBillType] = useState<'PAY' | 'RECEIVE'>('PAY');
  
  // New Goal States
  const [hasCar, setHasCar] = useState<boolean | null>(null);
  const [carValue, setCarValue] = useState('');
  
  const [hasHouse, setHasHouse] = useState<boolean | null>(null);
  const [houseValue, setHouseValue] = useState('');
  
  const [hasSavings, setHasSavings] = useState<boolean | null>(null);
  const [savingsValue, setSavingsValue] = useState('');

  const handleAddBill = () => {
    if (billDesc && billVal && billDay) {
      const dayNum = parseInt(billDay);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
        alert("Dia inválido (1-31)");
        return;
      }

      const today = new Date();
      const dueDate = new Date(today.getFullYear(), today.getMonth(), dayNum).toISOString();
      
      setBills([...bills, {
        description: billDesc,
        amount: parseFloat(billVal),
        dueDate: dueDate,
        dueDay: dayNum,
        type: billType,
        recurring: true
      }]);
      setBillDesc('');
      setBillVal('');
      setBillDay('');
    }
  };

  const nextStep = () => {
    if (step === 2 && billDesc && billVal && billDay) {
      handleAddBill();
    }
    setStep(prev => prev + 1);
  };

  const finish = () => {
    const generatedGoals = [];
    
    // 1. Car Goal
    if (carValue) {
      const val = parseFloat(carValue);
      generatedGoals.push({
        name: hasCar ? 'Manutenção Carro/Moto' : 'Comprar Carro/Moto',
        targetAmount: val * 0.30,
        currentAmount: 0,
        location: 'Cofre Automóvel',
        category: 'Carro',
        priority: 'Média',
        icon: '🚗',
        deadlineMonths: 36
      });
    }

    // 2. House Goal
    if (houseValue) {
      const val = parseFloat(houseValue);
      generatedGoals.push({
        name: hasHouse ? 'Reforma/Manutenção Casa' : 'Entrada da Casa Própria',
        targetAmount: val * 0.30,
        currentAmount: 0,
        location: 'Cofre Imobiliário',
        category: 'Casa',
        priority: 'Alta',
        icon: '🏠',
        deadlineMonths: 60
      });
    }

    // 3. Savings Goal
    const savedVal = parseFloat(savingsValue) || (hasSavings === false ? 1000 : 0);
    if (savedVal > 0) {
      generatedGoals.push({
        name: 'Reserva de Emergência',
        targetAmount: savedVal * 1.30,
        currentAmount: hasSavings ? savedVal : 0,
        location: 'Cofre de Segurança',
        category: 'Reserva',
        priority: 'Alta',
        icon: '🛡️',
        deadlineMonths: 12
      });
    }

    onComplete({
      income,
      bills,
      goals: generatedGoals
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
              <MoneyInput 
                autoFocus
                className="w-full bg-[#202C33] border border-transparent p-6 rounded-2xl text-2xl font-black outline-none focus:border-[#00A884] transition-all text-[#E9EDEF]"
                placeholder="R$ 0,00"
                value={income}
                onChange={(val) => setIncome(val)}
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
               <h3 className="text-xl font-black mt-4 text-[#E9EDEF]">Quais seus compromissos fixos?</h3>
            </div>
            
            <div className="bg-[#202C33] p-5 rounded-[2rem] space-y-3">
              <div className="flex bg-[#111B21] p-1 rounded-xl border border-[#2A3942]/40 mb-2">
                <button 
                  onClick={() => setBillType('PAY')}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${billType === 'PAY' ? 'bg-[#00A884] text-white shadow-sm' : 'text-[#8696A0]'}`}
                >
                  Gasto
                </button>
                <button 
                  onClick={() => setBillType('RECEIVE')}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${billType === 'RECEIVE' ? 'bg-blue-500 text-white shadow-sm' : 'text-[#8696A0]'}`}
                >
                  Recebimento
                </button>
              </div>

              <input 
                placeholder={billType === 'PAY' ? "Ex: Aluguel, Luz, Internet" : "Ex: Salário, Aluguel Recebido"} 
                className="w-full bg-[#111B21] border border-[#2A3942]/40 p-4 rounded-xl text-sm outline-none focus:border-[#00A884] font-bold text-[#E9EDEF]"
                value={billDesc} onChange={e => setBillDesc(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
              <MoneyInput 
                placeholder={billType === 'PAY' ? "Valor R$" : "Valor R$"} 
                className="w-full bg-[#111B21] border border-[#2A3942]/40 p-4 rounded-xl text-sm outline-none focus:border-[#00A884] font-bold text-[#E9EDEF]"
                value={Number(billVal) || 0} 
                onChange={val => setBillVal(val.toString())}
              />
                <input 
                  placeholder="Dia Venc." type="number" 
                  className="w-full bg-[#111B21] border border-[#2A3942]/40 p-4 rounded-xl text-sm outline-none focus:border-[#00A884] font-bold text-[#E9EDEF]"
                  value={billDay} onChange={e => setBillDay(e.target.value)}
                />
              </div>
              <button 
                onClick={handleAddBill}
                className={`w-full ${billType === 'PAY' ? 'bg-[#00A884]/20 text-[#00A884] border-[#00A884]/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'} py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border`}
              >
                + Adicionar {billType === 'PAY' ? 'Gasto' : 'Recebimento'}
              </button>
            </div>

            <div className="max-h-24 overflow-y-auto space-y-2 no-scrollbar px-1">
              {bills.map((b, i) => (
                <div key={i} className="flex justify-between items-center bg-[#202C33] p-3 rounded-xl border border-[#2A3942]/20 text-[11px] font-bold text-[#8696A0]">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${b.type === 'RECEIVE' ? 'bg-blue-500' : 'bg-rose-500'}`}></span>
                    <span>{b.description} (Dia {b.dueDay})</span>
                  </div>
                  <span className={`${b.type === 'RECEIVE' ? 'text-blue-400' : 'text-rose-500'} font-black`}>R$ {b.amount.toFixed(2)}</span>
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
          <div className="space-y-6 animate-fade">
            <div className="text-center">
               <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/20">Etapa 3: Patrimônio</span>
               <h3 className="text-xl font-black mt-4 text-[#E9EDEF]">Você tem carro ou moto?</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setHasCar(true)}
                className={`py-4 rounded-2xl font-black text-[11px] uppercase border transition-all ${hasCar === true ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#202C33] text-[#8696A0] border-[#2A3942]/40'}`}
              >
                Sim, eu tenho
              </button>
              <button 
                onClick={() => setHasCar(false)}
                className={`py-4 rounded-2xl font-black text-[11px] uppercase border transition-all ${hasCar === false ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#202C33] text-[#8696A0] border-[#2A3942]/40'}`}
              >
                Não, ainda não
              </button>
            </div>

            {hasCar !== null && (
              <div className="space-y-3 animate-fade">
                <p className="text-[10px] text-[#8696A0] font-black uppercase text-center">
                  {hasCar ? 'Qual o valor aproximado do seu veículo?' : 'Qual o valor do veículo que você deseja?'}
                </p>
                <div className="relative">
                  <MoneyInput 
                    className="w-full bg-[#202C33] border border-transparent p-5 rounded-2xl text-sm font-black outline-none focus:border-[#00A884] text-[#E9EDEF] transition-all"
                    placeholder="R$ 0,00"
                    value={Number(carValue) || 0}
                    onChange={(val) => setCarValue(val.toString())}
                  />
                </div>
                <button 
                  onClick={nextStep}
                  className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
                >
                  Próximo: Moradia
                </button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-fade">
            <div className="text-center">
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">Etapa 4: Moradia</span>
               <h3 className="text-xl font-black mt-4 text-[#E9EDEF]">Você tem casa própria?</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setHasHouse(true)}
                className={`py-4 rounded-2xl font-black text-[11px] uppercase border transition-all ${hasHouse === true ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#202C33] text-[#8696A0] border-[#2A3942]/40'}`}
              >
                Sim, eu tenho
              </button>
              <button 
                onClick={() => setHasHouse(false)}
                className={`py-4 rounded-2xl font-black text-[11px] uppercase border transition-all ${hasHouse === false ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#202C33] text-[#8696A0] border-[#2A3942]/40'}`}
              >
                Não, ainda não
              </button>
            </div>

            {hasHouse !== null && (
              <div className="space-y-3 animate-fade">
                <p className="text-[10px] text-[#8696A0] font-black uppercase text-center">
                  {hasHouse ? 'Qual o valor aproximado da sua casa?' : 'Qual o valor da casa que você deseja?'}
                </p>
                <div className="relative">
                  <MoneyInput 
                    className="w-full bg-[#202C33] border border-transparent p-5 rounded-2xl text-sm font-black outline-none focus:border-[#00A884] text-[#E9EDEF] transition-all"
                    placeholder="R$ 0,00"
                    value={Number(houseValue) || 0}
                    onChange={(val) => setHouseValue(val.toString())}
                  />
                </div>
                <button 
                  onClick={nextStep}
                  className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
                >
                  Próximo: Reserva
                </button>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-fade">
            <div className="text-center">
               <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">Etapa 5: Segurança</span>
               <h3 className="text-xl font-black mt-4 text-[#E9EDEF]">Você tem dinheiro guardado?</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setHasSavings(true)}
                className={`py-4 rounded-2xl font-black text-[11px] uppercase border transition-all ${hasSavings === true ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#202C33] text-[#8696A0] border-[#2A3942]/40'}`}
              >
                Sim, eu tenho
              </button>
              <button 
                onClick={() => setHasSavings(false)}
                className={`py-4 rounded-2xl font-black text-[11px] uppercase border transition-all ${hasSavings === false ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#202C33] text-[#8696A0] border-[#2A3942]/40'}`}
              >
                Não, ainda não
              </button>
            </div>

            {hasSavings !== null && (
              <div className="space-y-3 animate-fade">
                <p className="text-[10px] text-[#8696A0] font-black uppercase text-center">
                  {hasSavings ? 'Quanto você tem guardado hoje?' : 'Vamos começar com uma meta de R$ 1.000?'}
                </p>
                {hasSavings && (
                  <div className="relative">
                    <MoneyInput 
                      className="w-full bg-[#202C33] border border-transparent p-5 rounded-2xl text-sm font-black outline-none focus:border-[#00A884] text-[#E9EDEF] transition-all"
                      placeholder="R$ 0,00"
                      value={Number(savingsValue) || 0}
                      onChange={(val) => setSavingsValue(val.toString())}
                    />
                  </div>
                )}
                <button 
                  onClick={finish}
                  className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
                >
                  Concluir Configuração →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
