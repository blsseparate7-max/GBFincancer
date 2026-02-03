
import React, { useState, useMemo } from 'react';
import { SavingGoal, Transaction, UserAssets, GoalType } from '../types';

interface GoalsProps {
  goals: SavingGoal[];
  availableBalance: number;
  onAddGoal: (goal: Omit<SavingGoal, 'id' | 'createdAt' | 'ativa'>) => void;
  onUpdateGoal: (id: string, updates: Partial<SavingGoal>) => void;
  onDeleteGoal: (id: string) => void;
  transactions: Transaction[];
  userAssets: UserAssets;
  onUpdateAssets: (assets: UserAssets) => void;
}

interface SuggestedGoal {
  name: string;
  tipo: GoalType;
  targetAmount: number;
  currentAmount: number;
  prazoMeses: number;
  nivelEscada: number;
  monthlySaving: number;
  added?: boolean;
}

const Goals: React.FC<GoalsProps> = ({ 
  goals, 
  onAddGoal, 
  onUpdateGoal,
  onDeleteGoal, 
  transactions,
  userAssets,
  onUpdateAssets
}) => {
  const [surveyStep, setSurveyStep] = useState(0);
  const [tempAssets, setTempAssets] = useState<UserAssets>(userAssets);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedGoal[]>([]);

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const smartRoundUp = (valor: number) => {
    let step = 1000;
    if (valor <= 50000) step = 1000;
    else if (valor <= 200000) step = 5000;
    else step = 10000;
    return Math.ceil(valor / step) * step;
  };

  const handlePrepareSuggestions = () => {
    setIsProcessing(true);
    const newSuggestions: SuggestedGoal[] = [];

    // Lógica inteligente de metas automáticas
    if (tempAssets.targets.car > 0) {
      newSuggestions.push({
        name: "Degrau Veículo",
        tipo: 'carro',
        targetAmount: smartRoundUp(tempAssets.targets.car),
        currentAmount: 0,
        prazoMeses: 36,
        nivelEscada: 1,
        monthlySaving: tempAssets.targets.car / 36
      });
    }

    if (tempAssets.targets.house > 0) {
      newSuggestions.push({
        name: "Degrau Moradia",
        tipo: 'casa_entrada',
        targetAmount: smartRoundUp(tempAssets.targets.house),
        currentAmount: 0,
        prazoMeses: 60,
        nivelEscada: 2,
        monthlySaving: tempAssets.targets.house / 60
      });
    }

    newSuggestions.push({
      name: "Reserva de Emergência",
      tipo: 'reserva',
      targetAmount: 5000,
      currentAmount: tempAssets.savingsValue || 0,
      prazoMeses: 12,
      nivelEscada: 0,
      monthlySaving: 500 / 12
    });

    setSuggestions(newSuggestions);
    setSurveyStep(6);
    setIsProcessing(false);
  };

  const handleAddSuggestedGoal = (index: number) => {
    const sug = suggestions[index];
    if (sug.added) return;
    onAddGoal({ ...sug });
    const newSugs = [...suggestions];
    newSugs[index].added = true;
    setSuggestions(newSugs);
  };

  const handleFinishSurvey = () => {
    onUpdateAssets({ ...tempAssets, surveyCompleted: true });
  };

  if (!userAssets.surveyCompleted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-[#f0f2f5] overflow-y-auto no-scrollbar relative page-transition">
        <div className="absolute inset-0 opacity-5 pointer-events-none whatsapp-pattern"></div>
        <div className="max-w-md w-full space-y-6 py-10 relative z-10">
          
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-gray-100 text-center">
            {surveyStep === 0 && (
              <div className="space-y-6 animate-in slide-in-from-bottom">
                 <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto shadow-lg text-2xl font-black text-white italic">GB</div>
                 <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight uppercase">Mapeamento Patrimonial</h2>
                 <p className="text-sm text-gray-500 font-medium px-4 leading-relaxed">Para calcular seus degraus na Escada, preciso saber o que você já conquistou.</p>
                 <button onClick={() => setSurveyStep(1)} className="w-full bg-[#00a884] text-white font-bold py-5 rounded-[2rem] uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Começar Auditoria</button>
              </div>
            )}
            {surveyStep === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right">
                 <h2 className="text-xl font-bold text-gray-800 tracking-tight">Você possui veículo próprio?</h2>
                 <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => { setTempAssets({...tempAssets, hasCar: true}); setSurveyStep(2); }} className="bg-emerald-500 text-white py-5 rounded-[2rem] font-bold active:scale-95 transition-all">SIM</button>
                   <button onClick={() => { setTempAssets({...tempAssets, hasCar: false}); setSurveyStep(2); }} className="bg-slate-100 text-slate-400 py-5 rounded-[2rem] font-bold active:scale-95 transition-all">NÃO</button>
                 </div>
              </div>
            )}
            {surveyStep === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right">
                 <h2 className="text-lg font-bold text-gray-700">{tempAssets.hasCar ? "Valor estimado do seu veículo?" : "Quanto custa o carro que você deseja?"}</h2>
                 <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-xl">R$</span>
                   <input type="number" autoFocus className="w-full bg-slate-50 border-2 border-slate-100 p-6 pl-14 rounded-[2rem] text-center font-black outline-none text-2xl" placeholder="0,00" onChange={e => {
                     const v = Number(e.target.value);
                     tempAssets.hasCar ? setTempAssets({...tempAssets, carValue: v}) : setTempAssets({...tempAssets, targets: {...tempAssets.targets, car: v}});
                   }} />
                 </div>
                 <button onClick={() => setSurveyStep(3)} className="w-full bg-slate-900 text-white font-bold py-5 rounded-[2rem] uppercase text-xs">Próximo: Moradia</button>
              </div>
            )}
            {surveyStep === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right">
                 <h2 className="text-xl font-bold text-gray-800 tracking-tight">Você possui casa/apto próprio?</h2>
                 <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => { setTempAssets({...tempAssets, hasHouse: true}); setSurveyStep(4); }} className="bg-emerald-500 text-white py-5 rounded-[2rem] font-bold active:scale-95 transition-all">SIM</button>
                   <button onClick={() => { setTempAssets({...tempAssets, hasHouse: false}); setSurveyStep(4); }} className="bg-slate-100 text-slate-400 py-5 rounded-[2rem] font-bold active:scale-95 transition-all">NÃO</button>
                 </div>
              </div>
            )}
            {surveyStep === 4 && (
              <div className="space-y-6 animate-in slide-in-from-right">
                 <h2 className="text-lg font-bold text-gray-700">{tempAssets.hasHouse ? "Valor estimado do imóvel?" : "Qual o valor do imóvel dos seus sonhos?"}</h2>
                 <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-xl">R$</span>
                   <input type="number" autoFocus className="w-full bg-slate-50 border-2 border-slate-100 p-6 pl-14 rounded-[2rem] text-center font-black outline-none text-2xl" placeholder="0,00" onChange={e => {
                     const v = Number(e.target.value);
                     tempAssets.hasHouse ? setTempAssets({...tempAssets, houseValue: v}) : setTempAssets({...tempAssets, targets: {...tempAssets.targets, house: v}});
                   }} />
                 </div>
                 <button onClick={() => setSurveyStep(5)} className="w-full bg-slate-900 text-white font-bold py-5 rounded-[2rem] uppercase text-xs">Próximo: Reserva</button>
              </div>
            )}
            {surveyStep === 5 && (
              <div className="space-y-6 animate-in slide-in-from-right">
                 <h2 className="text-xl font-bold text-gray-800">Já tem dinheiro guardado?</h2>
                 <p className="text-xs text-slate-400">Pode ser CDB, Poupança ou Corretora.</p>
                 <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-xl">R$</span>
                   <input type="number" autoFocus className="w-full bg-slate-50 border-2 border-slate-100 p-6 pl-14 rounded-[2rem] text-center font-black outline-none text-2xl" placeholder="0,00" onChange={e => setTempAssets({...tempAssets, savingsValue: Number(e.target.value)})} />
                 </div>
                 <button onClick={handlePrepareSuggestions} className="w-full bg-[#00a884] text-white font-bold py-5 rounded-[2rem] uppercase text-xs shadow-xl">Finalizar Diagnóstico</button>
              </div>
            )}
            {surveyStep === 6 && (
              <div className="space-y-6 animate-in slide-in-from-bottom">
                <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-tight">Rota Estratégica</h2>
                <div className="space-y-3">
                  {suggestions.map((sug, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 p-5 rounded-[2rem] text-left hover:border-emerald-200 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-gray-800 text-sm">{sug.name}</h4>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full uppercase">{sug.prazoMeses/12} Anos</span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-medium mb-4">Meta: {currencyFormatter.format(sug.targetAmount)}</p>
                      <button 
                        onClick={() => handleAddSuggestedGoal(idx)} 
                        disabled={sug.added} 
                        className={`w-full py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all ${sug.added ? 'bg-emerald-50 text-emerald-300' : 'bg-white border border-gray-100 text-slate-900 hover:bg-emerald-500 hover:text-white shadow-sm'}`}
                      >
                        {sug.added ? "Degrau Adicionado" : "Incluir Degrau"}
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={handleFinishSurvey} className="w-full bg-slate-900 text-white font-bold py-5 rounded-[2rem] shadow-2xl uppercase text-xs mt-6">Acessar Escada Patrimonial</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto bg-[#f8fafc] no-scrollbar pb-32 page-transition">
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tighter uppercase italic">Escada Patrimonial</h2>
        <p className="text-[11px] text-emerald-600 font-black uppercase tracking-[0.2em] mt-1">Níveis de Evolução Financeira</p>
      </div>

      <div className="space-y-6">
        {goals.filter(g => g.ativa).map(goal => {
          const progressoPct = Math.min(100, Math.floor((goal.currentAmount / goal.targetAmount) * 100));
          return (
            <div key={goal.id} className="premium-card p-10 group transition-all hover:shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 text-4xl opacity-5 grayscale group-hover:grayscale-0 transition-all">
                {goal.tipo === 'carro' ? '🚗' : goal.tipo === 'casa_entrada' ? '🏠' : '🛡️'}
              </div>
              
              <div className="mb-8">
                <h4 className="font-black text-slate-900 text-2xl tracking-tighter italic uppercase leading-none mb-2">{goal.name}</h4>
                <div className="flex gap-2">
                   <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">Nível {goal.nivelEscada}</span>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">{currencyFormatter.format(goal.targetAmount)}</span>
                </div>
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between items-end">
                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Conclusão: {progressoPct}%</span>
                    <span className="text-xl font-black text-slate-900 italic tracking-tighter">{currencyFormatter.format(goal.currentAmount)}</span>
                 </div>
                 <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden shadow-inner border border-gray-100">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(16,185,129,0.3)]" style={{ width: `${progressoPct}%` }} />
                 </div>
              </div>

              <div className="mt-10 pt-8 border-t border-gray-50 flex justify-between items-center">
                 <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Aporte Mensal Recomendado</p>
                    <p className="text-lg font-black text-emerald-600 italic tracking-tighter">{currencyFormatter.format(goal.monthlySaving || 0)}</p>
                 </div>
                 <button onClick={() => onDeleteGoal(goal.id)} className="text-[9px] font-black text-rose-300 uppercase hover:text-rose-500 transition-colors">Remover</button>
              </div>
            </div>
          );
        })}
        
        {goals.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-gray-100">
             <p className="text-gray-300 font-black uppercase text-[10px] tracking-widest">Escada Vazia. Adicione degraus no Diagnóstico.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Goals;
