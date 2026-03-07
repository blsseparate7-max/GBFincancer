
import React, { useState, useMemo } from 'react';
import { 
  UserSession, 
  OccupationType, 
  IncomeSourceType, 
  IncomeFrequency, 
  IncomeSource, 
  IncomeProfile 
} from '../types';
import MoneyInput from './MoneyInput';
import { 
  Briefcase, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Plus,
  Trash2,
  ShieldCheck,
  Building2,
  User,
  Clock,
  CalendarDays
} from 'lucide-react';

interface SetupWizardProps {
  user: UserSession;
  onComplete: (data: { incomeProfile: IncomeProfile; bills: any[]; goals: any[] }) => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(0);
  const [occupation, setOccupation] = useState<OccupationType | null>(null);
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  // Form states for new source
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [newSourceType, setNewSourceType] = useState<IncomeSourceType>('SALARY');
  const [newSourceFreq, setNewSourceFreq] = useState<IncomeFrequency>('MONTHLY');
  const [newSourceDates, setNewSourceDates] = useState<number[]>([]);
  const [newSourceAmount, setNewSourceAmount] = useState<number>(0);
  const [newSourceDesc, setNewSourceDesc] = useState('');

  // Form states for bills
  const [billDesc, setBillDesc] = useState('');
  const [billVal, setBillVal] = useState('');
  const [billDay, setBillDay] = useState('');
  const [billType, setBillType] = useState<'PAY' | 'RECEIVE'>('PAY');

  // Form states for goals
  const [hasCar, setHasCar] = useState<boolean | null>(null);
  const [carValue, setCarValue] = useState('');
  const [hasHouse, setHasHouse] = useState<boolean | null>(null);
  const [houseValue, setHouseValue] = useState('');
  const [hasSavings, setHasSavings] = useState<boolean | null>(null);
  const [savingsValue, setSavingsValue] = useState('');

  const totalSteps = 6;
  const progress = ((step) / (totalSteps - 1)) * 100;

  const occupationOptions: { id: OccupationType; label: string; icon: any; desc: string }[] = [
    { id: 'CLT', label: 'Salário Mensal (CLT)', icon: Briefcase, desc: 'Recebe salário fixo, vale e benefícios.' },
    { id: 'BIWEEKLY', label: 'Quinzenal', icon: Clock, desc: 'Recebe duas vezes por mês.' },
    { id: 'WEEKLY', label: 'Semanal', icon: CalendarDays, desc: 'Recebe toda semana.' },
    { id: 'DAILY', label: 'Diário', icon: TrendingUp, desc: 'Recebe por dia trabalhado.' },
    { id: 'ENTREPRENEUR', label: 'Empresário / Pró-labore', icon: Building2, desc: 'Retiradas fixas ou variáveis do negócio.' },
    { id: 'AUTONOMOUS', label: 'Autônomo / Freelancer', icon: User, desc: 'Recebe conforme realiza serviços.' },
    { id: 'OTHER', label: 'Outro', icon: DollarSign, desc: 'Outras formas de rendimento.' },
  ];

  const sourceTypes: { id: IncomeSourceType; label: string }[] = [
    { id: 'SALARY', label: 'Salário' },
    { id: 'VALE', label: 'Vale / Adiantamento' },
    { id: 'COMMISSION', label: 'Comissão' },
    { id: 'PRO_LABORE', label: 'Pró-labore' },
    { id: 'PIX_SALES', label: 'Pix / Vendas' },
    { id: 'DAILY', label: 'Diária' },
    { id: 'OTHER', label: 'Outro' },
  ];

  const frequencies: { id: IncomeFrequency; label: string }[] = [
    { id: 'MONTHLY', label: '1 vez por mês' },
    { id: 'BIWEEKLY', label: '2 vezes por mês' },
    { id: 'WEEKLY', label: '4 vezes por mês (Semanal)' },
    { id: 'DAILY', label: 'Todos os dias úteis' },
    { id: 'VARIABLE', label: 'Datas variáveis' },
  ];

  const handleAddSource = () => {
    if (!newSourceDesc) return;
    const source: IncomeSource = {
      id: Math.random().toString(36).substr(2, 9),
      type: newSourceType,
      frequency: newSourceFreq,
      dates: newSourceDates,
      amountExpected: newSourceAmount > 0 ? newSourceAmount : undefined,
      description: newSourceDesc
    };
    setSources([...sources, source]);
    setNewSourceDesc('');
    setNewSourceAmount(0);
    setNewSourceDates([]);
    setShowSourceForm(false);
  };

  const handleAddBill = () => {
    if (billDesc && billVal && billDay) {
      const dayNum = parseInt(billDay);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return;
      
      setBills([...bills, {
        description: billDesc,
        amount: parseFloat(billVal),
        dueDay: dayNum,
        type: billType,
        recurring: true
      }]);
      setBillDesc('');
      setBillVal('');
      setBillDay('');
    }
  };

  const finish = () => {
    const generatedGoals = [];
    if (carValue) {
      generatedGoals.push({
        name: hasCar ? 'Manutenção Carro/Moto' : 'Comprar Carro/Moto',
        targetAmount: parseFloat(carValue) * 0.30,
        currentAmount: 0,
        location: 'Cofre Automóvel',
        category: 'Carro',
        priority: 'Média',
        icon: '🚗',
        deadlineMonths: 36
      });
    }
    if (houseValue) {
      generatedGoals.push({
        name: hasHouse ? 'Reforma/Manutenção Casa' : 'Entrada da Casa Própria',
        targetAmount: parseFloat(houseValue) * 0.30,
        currentAmount: 0,
        location: 'Cofre Imobiliário',
        category: 'Casa',
        priority: 'Alta',
        icon: '🏠',
        deadlineMonths: 60
      });
    }
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

    const incomeProfile: IncomeProfile = {
      occupationType: occupation || 'OTHER',
      sources,
      totalExpectedMonthly: sources.reduce((acc, s) => acc + (s.amountExpected || 0), 0)
    };

    onComplete({
      incomeProfile,
      bills,
      goals: generatedGoals
    });
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-24 h-24 bg-[#00A884] rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl text-white text-5xl font-black italic transform -rotate-6">GB</div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-[#E9EDEF] uppercase tracking-tighter leading-tight">Olá, {user.name.split(' ')[0]}!</h2>
              <p className="text-base text-[#8696A0] leading-relaxed max-w-xs mx-auto">
                Vamos configurar sua inteligência financeira. Preciso entender como seu dinheiro entra para te dar os melhores insights.
              </p>
            </div>
            <button 
              onClick={() => setStep(1)}
              className="w-full bg-[#00A884] text-white font-black py-6 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              Começar Configuração <ArrowRight size={18} />
            </button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-2">
               <span className="text-[10px] font-black text-[#00A884] uppercase tracking-widest bg-[#00A884]/10 px-4 py-1.5 rounded-full border border-[#00A884]/20">Perfil de Recebimento</span>
               <h3 className="text-2xl font-black text-[#E9EDEF] tracking-tight">Como você recebe seu dinheiro?</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {occupationOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setOccupation(opt.id); setStep(2); }}
                  className={`flex items-center gap-4 p-5 rounded-3xl border-2 text-left transition-all active:scale-[0.98] ${
                    occupation === opt.id 
                      ? 'bg-[#00A884]/10 border-[#00A884] shadow-lg' 
                      : 'bg-[#202C33] border-transparent hover:border-[#2A3942]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${occupation === opt.id ? 'bg-[#00A884] text-white' : 'bg-[#111B21] text-[#8696A0]'}`}>
                    <opt.icon size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-[#E9EDEF] text-sm uppercase">{opt.label}</h4>
                    <p className="text-[10px] text-[#8696A0] font-medium leading-tight mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-2">
               <span className="text-[10px] font-black text-[#00A884] uppercase tracking-widest bg-[#00A884]/10 px-4 py-1.5 rounded-full border border-[#00A884]/20">Fontes de Renda</span>
               <h3 className="text-2xl font-black text-[#E9EDEF] tracking-tight">Quais são suas entradas?</h3>
               <p className="text-xs text-[#8696A0]">Adicione todas as formas que você recebe dinheiro.</p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {sources.map((s) => (
                <div key={s.id} className="bg-[#202C33] p-4 rounded-2xl border border-[#2A3942]/40 flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#00A884]/20 text-[#00A884] rounded-xl flex items-center justify-center">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#E9EDEF] uppercase">{s.description}</h4>
                      <p className="text-[9px] text-[#8696A0] font-bold uppercase">{s.type} • {s.frequency}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    {s.amountExpected && <span className="text-xs font-black text-[#00A884]">R$ {s.amountExpected.toFixed(2)}</span>}
                    <button onClick={() => setSources(sources.filter(src => src.id !== s.id))} className="text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {!showSourceForm ? (
                <button 
                  onClick={() => setShowSourceForm(true)}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-[#2A3942] text-[#8696A0] font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:border-[#00A884] hover:text-[#00A884] transition-all"
                >
                  <Plus size={16} /> Adicionar Fonte de Renda
                </button>
              ) : (
                <div className="bg-[#202C33] p-6 rounded-3xl border border-[#00A884]/30 space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Descrição (Ex: Salário Empresa X)</label>
                    <input 
                      className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                      value={newSourceDesc} onChange={e => setNewSourceDesc(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Tipo</label>
                      <select 
                        className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none appearance-none"
                        value={newSourceType} onChange={e => setNewSourceType(e.target.value as any)}
                      >
                        {sourceTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Frequência</label>
                      <select 
                        className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none appearance-none"
                        value={newSourceFreq} onChange={e => setNewSourceFreq(e.target.value as any)}
                      >
                        {frequencies.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#8696A0] uppercase ml-2">Valor Médio (Opcional)</label>
                    <MoneyInput 
                      className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                      value={newSourceAmount} onChange={val => setNewSourceAmount(val)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddSource} className="flex-1 bg-[#00A884] text-white py-3 rounded-xl font-black text-[10px] uppercase">Salvar</button>
                    <button onClick={() => setShowSourceForm(false)} className="flex-1 bg-[#111B21] text-[#8696A0] py-3 rounded-xl font-black text-[10px] uppercase">Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => sources.length > 0 ? setStep(3) : alert("Adicione pelo menos uma fonte de renda")}
              className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              Próximo: Gastos Fixos <ArrowRight size={18} />
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-2">
               <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-4 py-1.5 rounded-full border border-rose-500/20">Compromissos Fixos</span>
               <h3 className="text-2xl font-black text-[#E9EDEF] tracking-tight">O que você já tem que pagar?</h3>
               <p className="text-xs text-[#8696A0]">Aluguel, Luz, Internet, Assinaturas...</p>
            </div>
            
            <div className="bg-[#202C33] p-6 rounded-[2.5rem] space-y-4 border border-[#2A3942]/40">
              <div className="flex bg-[#111B21] p-1.5 rounded-2xl border border-[#2A3942]/40">
                <button 
                  onClick={() => setBillType('PAY')}
                  className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${billType === 'PAY' ? 'bg-[#00A884] text-white shadow-lg' : 'text-[#8696A0]'}`}
                >
                  Gasto
                </button>
                <button 
                  onClick={() => setBillType('RECEIVE')}
                  className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${billType === 'RECEIVE' ? 'bg-blue-500 text-white shadow-lg' : 'text-[#8696A0]'}`}
                >
                  Recebimento
                </button>
              </div>

              <div className="space-y-3">
                <input 
                  placeholder={billType === 'PAY' ? "Ex: Aluguel, Luz, Internet" : "Ex: Salário, Aluguel Recebido"} 
                  className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                  value={billDesc} onChange={e => setBillDesc(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <MoneyInput 
                    placeholder="Valor R$" 
                    className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                    value={Number(billVal) || 0} 
                    onChange={val => setBillVal(val.toString())}
                  />
                  <input 
                    placeholder="Dia Venc." type="number" 
                    className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                    value={billDay} onChange={e => setBillDay(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleAddBill}
                  className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-dashed transition-all ${
                    billType === 'PAY' ? 'border-[#00A884]/30 text-[#00A884] hover:bg-[#00A884]/5' : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/5'
                  }`}
                >
                  + Adicionar {billType === 'PAY' ? 'Gasto' : 'Recebimento'}
                </button>
              </div>
            </div>

            <div className="max-h-24 overflow-y-auto space-y-2 px-1">
              {bills.map((b, i) => (
                <div key={i} className="flex justify-between items-center bg-[#202C33] p-4 rounded-2xl border border-[#2A3942]/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${b.type === 'RECEIVE' ? 'bg-blue-500' : 'bg-rose-500'}`}></div>
                    <span className="text-xs font-black text-[#E9EDEF] uppercase">{b.description}</span>
                  </div>
                  <span className={`text-xs font-black ${b.type === 'RECEIVE' ? 'text-blue-400' : 'text-rose-500'}`}>R$ {b.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setStep(4)}
              className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              Próximo: Metas <ArrowRight size={18} />
            </button>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-2">
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20">Metas e Patrimônio</span>
               <h3 className="text-2xl font-black text-[#E9EDEF] tracking-tight">Onde você quer chegar?</h3>
            </div>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {/* Carro */}
              <div className="bg-[#202C33] p-6 rounded-[2.5rem] border border-[#2A3942]/40 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-black text-[#E9EDEF] uppercase italic">Automóvel</h4>
                  <div className="flex gap-2">
                    <button onClick={() => setHasCar(true)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${hasCar === true ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#111B21] text-[#8696A0] border-[#2A3942]/40'}`}>Sim</button>
                    <button onClick={() => setHasCar(false)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${hasCar === false ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#111B21] text-[#8696A0] border-[#2A3942]/40'}`}>Não</button>
                  </div>
                </div>
                {hasCar !== null && (
                  <MoneyInput 
                    className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                    placeholder={hasCar ? "Valor do seu veículo" : "Valor do veículo desejado"}
                    value={Number(carValue) || 0}
                    onChange={(val) => setCarValue(val.toString())}
                  />
                )}
              </div>

              {/* Casa */}
              <div className="bg-[#202C33] p-6 rounded-[2.5rem] border border-[#2A3942]/40 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-black text-[#E9EDEF] uppercase italic">Moradia</h4>
                  <div className="flex gap-2">
                    <button onClick={() => setHasHouse(true)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${hasHouse === true ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#111B21] text-[#8696A0] border-[#2A3942]/40'}`}>Sim</button>
                    <button onClick={() => setHasHouse(false)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${hasHouse === false ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#111B21] text-[#8696A0] border-[#2A3942]/40'}`}>Não</button>
                  </div>
                </div>
                {hasHouse !== null && (
                  <MoneyInput 
                    className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                    placeholder={hasHouse ? "Valor do seu imóvel" : "Valor do imóvel desejado"}
                    value={Number(houseValue) || 0}
                    onChange={(val) => setHouseValue(val.toString())}
                  />
                )}
              </div>

              {/* Reserva */}
              <div className="bg-[#202C33] p-6 rounded-[2.5rem] border border-[#2A3942]/40 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-black text-[#E9EDEF] uppercase italic">Reserva</h4>
                  <div className="flex gap-2">
                    <button onClick={() => setHasSavings(true)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${hasSavings === true ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#111B21] text-[#8696A0] border-[#2A3942]/40'}`}>Sim</button>
                    <button onClick={() => setHasSavings(false)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${hasSavings === false ? 'bg-[#00A884] text-white border-[#00A884]' : 'bg-[#111B21] text-[#8696A0] border-[#2A3942]/40'}`}>Não</button>
                  </div>
                </div>
                {hasSavings === true && (
                  <MoneyInput 
                    className="w-full bg-[#111B21] p-4 rounded-xl text-sm font-bold text-[#E9EDEF] outline-none border-2 border-transparent focus:border-[#00A884] transition-all"
                    placeholder="Quanto tem guardado?"
                    value={Number(savingsValue) || 0}
                    onChange={(val) => setSavingsValue(val.toString())}
                  />
                )}
              </div>
            </div>

            <button 
              onClick={() => setStep(5)}
              className="w-full bg-[#00A884] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              Finalizar Configuração <ArrowRight size={18} />
            </button>
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-[#00A884]/10 text-[#00A884] rounded-full flex items-center justify-center mx-auto border-2 border-[#00A884]/20">
              <ShieldCheck size={48} />
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-[#E9EDEF] uppercase tracking-tighter italic">Tudo pronto!</h3>
              <p className="text-sm text-[#8696A0] leading-relaxed">
                Essas informações ajudam o <span className="text-[#00A884] font-black">GBFinancer</span> a entender como o seu dinheiro entra ao longo do mês.
              </p>
              <p className="text-sm text-[#8696A0] leading-relaxed">
                Com isso, o sistema consegue organizar melhor o Dashboard, criar lembretes mais úteis, gerar análises mais inteligentes e acompanhar sua vida financeira de forma mais realista.
              </p>
            </div>
            <button 
              onClick={finish}
              className="w-full bg-[#00A884] text-white font-black py-6 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              Continuar para o app
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[#0B141A] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="absolute inset-0 whatsapp-pattern opacity-[0.03] pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-md bg-[#111B21] rounded-[3rem] shadow-2xl p-8 border border-[#2A3942]/60 flex flex-col min-h-[500px]">
        {/* Progress Bar */}
        {step > 0 && (
          <div className="w-full h-1.5 bg-[#202C33] rounded-full mb-8 overflow-hidden">
            <div 
              className="h-full bg-[#00A884] transition-all duration-500 shadow-[0_0_10px_rgba(0,168,132,0.5)]" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Back Button */}
        {step > 0 && step < 5 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="absolute top-8 left-8 text-[#8696A0] hover:text-[#E9EDEF] transition-all"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="flex-1 flex flex-col justify-center">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
