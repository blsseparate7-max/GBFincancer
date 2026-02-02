
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

  // 1. ARREDONDAMENTO INTELIGENTE
  const smartRoundUp = (valor: number) => {
    let step = 50;
    if (valor <= 2000) step = 50;
    else if (valor <= 10000) step = 100;
    else if (valor <= 50000) step = 500;
    else if (valor <= 200000) step = 1000;
    else step = 5000;
    return Math.ceil(valor / step) * step;
  };

  // 2. CÁLCULO DE CAPACIDADE REAL (DASHBOARD + HISTÓRICO)
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Sobra do mês atual
    const currentMonthT = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const entriesNow = currentMonthT.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const exitsNow = currentMonthT.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const sobraAtual = entriesNow - exitsNow;

    // Média de histórico (últimos 3 meses)
    const historyMonths = [1, 2, 3].map(offset => {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthT = transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y;
      });
      const entries = monthT.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const exits = monthT.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      return entries - exits;
    }).filter(s => s !== 0); // Considera apenas meses com movimentação

    const sobraMedia = historyMonths.length >= 3 
      ? historyMonths.reduce((a, b) => a + b, 0) / historyMonths.length 
      : sobraAtual;

    const capacidade = Math.max(0, sobraMedia);

    return { capacidade, sobraAtual };
  }, [transactions]);

  const activeGoals = useMemo(() => goals.filter(g => g.ativa), [goals]);

  // 3. PREPARAR SUGESTÕES PATRIMONIAIS
  const handlePrepareSuggestions = () => {
    setIsProcessing(true);
    const newSuggestions: SuggestedGoal[] = [];

    // META 1 — VEÍCULO (30% do base)
    const valorVeiculoBase = tempAssets.hasCar ? tempAssets.carValue : tempAssets.targets.car;
    const alvoVeiculo = smartRoundUp(Math.max(1000, valorVeiculoBase * 0.30));
    newSuggestions.push({
      name: "Meta Veículo",
      tipo: 'carro',
      targetAmount: alvoVeiculo,
      currentAmount: 0,
      prazoMeses: 36, // Padrão 3 anos para estimativa inicial
      nivelEscada: 1,
      monthlySaving: alvoVeiculo / 36
    });

    // META 2 — CASA (30% do base)
    const valorCasaBase = tempAssets.hasHouse ? tempAssets.houseValue : tempAssets.targets.house;
    const alvoCasa = smartRoundUp(Math.max(1000, valorCasaBase * 0.30));
    newSuggestions.push({
      name: "Entrada da Casa",
      tipo: 'casa_entrada',
      targetAmount: alvoCasa,
      currentAmount: 0,
      prazoMeses: 60, // Padrão 5 anos
      nivelEscada: 1,
      monthlySaving: alvoCasa / 60
    });

    // META 3 — RESERVA
    let alvoReserva = 1000;
    let atualReserva = 0;
    if (tempAssets.savingsValue > 0) {
      atualReserva = tempAssets.savingsValue;
      alvoReserva = smartRoundUp(Math.max(1000, tempAssets.savingsValue * 1.30));
    }
    newSuggestions.push({
      name: "Reserva",
      tipo: 'reserva',
      targetAmount: alvoReserva,
      currentAmount: atualReserva,
      prazoMeses: 12, // Padrão 1 ano
      nivelEscada: 1,
      monthlySaving: Math.max(0, (alvoReserva - atualReserva) / 12)
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

  if (!userAssets.surveyCompleted || (activeGoals.length === 0 && !isProcessing && suggestions.length === 0)) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-950 text-white overflow-y-auto no-scrollbar">
        <div className="max-w-xs w-full text-center space-y-8 py-10">
          <div className="w-20 h-20 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl text-2xl font-black">🎯</div>
          
          {isProcessing ? (
             <p className="text-sm font-black uppercase text-emerald-500 animate-pulse">Calculando Rota Patrimonial...</p>
          ) : (
            <>
              {surveyStep === 0 && (
                <div className="space-y-4 animate-in slide-in-from-right">
                   <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-tight">Configurar Metas</h2>
                   <p className="text-xs opacity-60">Vamos definir sua estratégia de crescimento baseada no seu patrimônio atual.</p>
                   <button onClick={() => setSurveyStep(1)} className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest">Iniciar Agora</button>
                </div>
              )}
              {surveyStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right">
                   <h2 className="text-xl font-black uppercase tracking-tighter italic">Tem CARRO/MOTO?</h2>
                   <div className="flex gap-2">
                     <button onClick={() => { setTempAssets({...tempAssets, hasCar: true}); setSurveyStep(2); }} className="flex-1 bg-emerald-600 py-4 rounded-xl font-black">SIM</button>
                     <button onClick={() => { setTempAssets({...tempAssets, hasCar: false}); setSurveyStep(2); }} className="flex-1 bg-slate-800 py-4 rounded-xl font-black">NÃO</button>
                   </div>
                </div>
              )}
              {surveyStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right">
                   <h2 className="text-lg font-black uppercase">{tempAssets.hasCar ? "Valor atual do veículo?" : "Valor do veículo que deseja?"}</h2>
                   <input type="number" autoFocus className="w-full bg-white/10 border border-white/20 p-4 rounded-xl text-center font-black outline-none" placeholder="R$ 0,00" onChange={e => {
                     const v = Number(e.target.value);
                     tempAssets.hasCar ? setTempAssets({...tempAssets, carValue: v}) : setTempAssets({...tempAssets, targets: {...tempAssets.targets, car: v}});
                   }} />
                   <button onClick={() => setSurveyStep(3)} className="w-full bg-white text-slate-900 font-black py-4 rounded-xl uppercase text-[10px]">Continuar</button>
                </div>
              )}
              {surveyStep === 3 && (
                <div className="space-y-4 animate-in slide-in-from-right">
                   <h2 className="text-xl font-black uppercase tracking-tighter italic">Tem CASA Própria?</h2>
                   <div className="flex gap-2">
                     <button onClick={() => { setTempAssets({...tempAssets, hasHouse: true}); setSurveyStep(4); }} className="flex-1 bg-emerald-600 py-4 rounded-xl font-black">SIM</button>
                     <button onClick={() => { setTempAssets({...tempAssets, hasHouse: false}); setSurveyStep(4); }} className="flex-1 bg-slate-800 py-4 rounded-xl font-black">NÃO</button>
                   </div>
                </div>
              )}
              {surveyStep === 4 && (
                <div className="space-y-4 animate-in slide-in-from-right">
                   <h2 className="text-lg font-black uppercase">Valor da casa (ou entrada desejada)?</h2>
                   <input type="number" autoFocus className="w-full bg-white/10 border border-white/20 p-4 rounded-xl text-center font-black outline-none" placeholder="R$ 0,00" onChange={e => {
                     const v = Number(e.target.value);
                     tempAssets.hasHouse ? setTempAssets({...tempAssets, houseValue: v}) : setTempAssets({...tempAssets, targets: {...tempAssets.targets, house: v}});
                   }} />
                   <button onClick={() => setSurveyStep(5)} className="w-full bg-white text-slate-900 font-black py-4 rounded-xl uppercase text-[10px]">Continuar</button>
                </div>
              )}
              {surveyStep === 5 && (
                <div className="space-y-4 animate-in slide-in-from-right">
                   <h2 className="text-xl font-black uppercase tracking-tighter italic">Dinheiro Guardado?</h2>
                   <input type="number" autoFocus className="w-full bg-white/10 border border-white/20 p-4 rounded-xl text-center font-black outline-none" placeholder="Quanto já tem? R$ 0,00" onChange={e => setTempAssets({...tempAssets, savingsValue: Number(e.target.value)})} />
                   <button onClick={handlePrepareSuggestions} className="w-full bg-emerald-500 text-white font-black py-4 rounded-xl uppercase text-[10px] shadow-lg">Ver Minha Rota</button>
                </div>
              )}
              {surveyStep === 6 && (
                <div className="space-y-6 animate-in slide-in-from-bottom max-w-sm w-full">
                  <h2 className="text-xl font-black uppercase italic tracking-tighter">Sugestões de Escada</h2>
                  <div className="space-y-4">
                    {suggestions.map((sug, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-[2rem] text-left">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-black text-sm uppercase tracking-tighter">{sug.name}</h4>
                          <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{sug.prazoMeses/12} Anos</span>
                        </div>
                        <p className="text-[10px] opacity-40 mb-3">Meta Alvo: {currencyFormatter.format(sug.targetAmount)}</p>
                        <button onClick={() => handleAddSuggestedGoal(idx)} disabled={sug.added} className={`w-full py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${sug.added ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white text-slate-900 hover:bg-emerald-500 hover:text-white'}`}>
                          {sug.added ? "Criada ✓" : "Criar esta Meta"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleFinishSurvey} className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl shadow-2xl uppercase text-[10px] tracking-widest mt-8">Concluir Configuração</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#f8fafc] no-scrollbar pb-32">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic">Minha Escada</h2>
        <div className="mt-2 p-4 bg-white rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm">
           <div>
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Sua Capacidade Mensal</p>
              <p className="text-sm font-black text-emerald-600">{currencyFormatter.format(dashboardStats.capacidade)}</p>
           </div>
           <div className="text-right">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Sobra Atual</p>
              <p className="text-sm font-black text-slate-400">{currencyFormatter.format(dashboardStats.sobraAtual)}</p>
           </div>
        </div>
      </div>

      <div className="space-y-6">
        {activeGoals.map(goal => {
          const faltante = Math.max(0, goal.targetAmount - goal.currentAmount);
          const capacidade = dashboardStats.capacidade;
          const mesesEstimados = capacidade > 0 ? Math.ceil(faltante / capacidade) : null;
          const sugestaoGuardar = Math.min(capacidade, faltante);
          const progressoPct = Math.min(100, Math.floor((goal.currentAmount / goal.targetAmount) * 100));

          return (
            <div key={goal.id} className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100 animate-in slide-in-from-bottom">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-black text-slate-900 text-lg tracking-tight leading-none mb-1">{goal.name}</h4>
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Nível {goal.nivelEscada} • Alvo: {currencyFormatter.format(goal.targetAmount)}</p>
                </div>
                <span className="text-[9px] font-black text-slate-400">{progressoPct}%</span>
              </div>

              <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden mb-6">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${progressoPct}%` }} />
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-gray-50 pt-4">
                <div className="flex justify-between items-center">
                   <p className="text-[8px] font-black text-gray-400 uppercase">Conclui em:</p>
                   <p className="text-[10px] font-black text-slate-800">
                     {mesesEstimados !== null 
                        ? `${mesesEstimados} meses` 
                        : "Sobra insuficiente"}
                   </p>
                </div>
                <div className="flex justify-between items-center">
                   <p className="text-[8px] font-black text-gray-400 uppercase">Sugestão este mês:</p>
                   <p className="text-[10px] font-black text-emerald-600">{currencyFormatter.format(sugestaoGuardar)}</p>
                </div>
                {capacidade <= 0 && (
                  <p className="text-[8px] font-bold text-rose-500 uppercase mt-1 italic text-center">
                    No momento não sobra dinheiro no mês. Primeiro precisamos criar sobra.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Goals;
