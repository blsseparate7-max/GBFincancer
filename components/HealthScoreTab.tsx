
import React, { useMemo } from 'react';
import { Transaction, SavingGoal } from '../types';

interface HealthScoreTabProps {
  transactions: Transaction[];
  goals: SavingGoal[];
  onNavigateToGoals?: () => void;
}

interface ScoreData {
  score: number;
  sobraPct: number;
  sobraMes: number;
  entradasMes: number;
  saidasMes: number;
  nivel: string;
  colorClass: string;
  recomendacoes: string[];
}

const HealthScoreTab: React.FC<HealthScoreTabProps> = ({ 
  transactions = [], 
  goals = [],
  onNavigateToGoals
}) => {

  const computeScoreFromSobra = (entradas: number, saidas: number, maiorCatNome: string): ScoreData => {
    const sobraMes = entradas - saidas;
    const sobraPct = entradas > 0 ? (sobraMes / entradas) * 100 : 0;

    let score = 0;
    let recomendacoes: string[] = [];

    if (entradas <= 0) {
      score = 0;
      recomendacoes = ["Adicione uma entrada para calcular seu score.", "O GB precisa de dados de receita para auditar sua saúde.", "Registre seu salário no chat."];
    } else {
      if (sobraPct >= 30) score = 100;
      else if (sobraPct >= 20) score = 90;
      else if (sobraPct >= 10) score = 75;
      else if (sobraPct >= 5) score = 60;
      else if (sobraPct >= 0) score = 45;
      else if (sobraPct > -10) score = 25;
      else score = 10;

      if (sobraPct < 0) {
        recomendacoes = [
          `Reduza a categoria "${maiorCatNome}" em 15%.`,
          "Evite despesas variáveis extras.",
          "Analise gastos fixos para renegociar."
        ];
      } else {
        recomendacoes = [
          `Boa sobra de ${sobraPct.toFixed(1)}%.`,
          "Crie uma nova meta de patrimônio.",
          "Considere investir a sobra agora."
        ];
      }
    }

    score = Math.min(100, Math.max(0, score));

    let nivel = "Crítico";
    let colorClass = "text-rose-500";
    if (score >= 80) { nivel = "Excelente"; colorClass = "text-emerald-500"; }
    else if (score >= 60) { nivel = "Bom"; colorClass = "text-blue-500"; }
    else if (score >= 40) { nivel = "Atenção"; colorClass = "text-amber-500"; }

    return {
      score,
      sobraPct,
      sobraMes,
      entradasMes: entradas,
      saidasMes: saidas,
      nivel,
      colorClass,
      recomendacoes
    };
  };

  const scoreResult = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyT = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const entradas = monthlyT.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const saidas = monthlyT.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

    const catMap: Record<string, number> = {};
    monthlyT.filter(t => t.type === 'EXPENSE').forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    const maiorCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Outros';

    return computeScoreFromSobra(entradas, saidas, maiorCat);
  }, [transactions]);

  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto no-scrollbar p-6 space-y-6 pb-32">
      <div className="text-center pt-4">
        <h2 className="text-xl font-black text-gray-900 tracking-tighter italic uppercase">Saúde Financeira</h2>
      </div>

      <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-gray-100 flex flex-col items-center text-center">
        <div className="flex flex-col items-center">
          <span className={`text-8xl font-black tracking-tighter ${scoreResult.colorClass} leading-none`}>
            {scoreResult.score}
          </span>
          <span className="text-[10px] font-black uppercase text-gray-400 mt-4 tracking-[0.3em]">Eficiência Total</span>
          <h3 className={`text-xl font-black uppercase italic ${scoreResult.colorClass} mt-2 tracking-tighter`}>{scoreResult.nivel}</h3>
        </div>
      </div>

      <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Sobra</p>
            <p className="text-lg font-black text-emerald-400">{scoreResult.sobraPct.toFixed(1)}%</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Saldo Mês</p>
            <p className={`text-lg font-black ${scoreResult.sobraMes >= 0 ? 'text-white' : 'text-rose-500'}`}>
              {currency.format(scoreResult.sobraMes)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 italic">Ações de Melhora</h3>
        <ul className="space-y-4">
          {scoreResult.recomendacoes.map((rec, i) => (
            <li key={i} className="flex items-center gap-3">
               <div className="w-5 h-5 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <span className="text-[9px] text-slate-400 font-black">{i+1}</span>
               </div>
               <p className="text-[11px] font-bold text-slate-600 leading-tight">{rec}</p>
            </li>
          ))}
        </ul>
      </div>

      <button 
        onClick={onNavigateToGoals}
        className="w-full bg-slate-950 p-6 rounded-[2.5rem] flex items-center justify-between shadow-xl active:scale-95 transition-all"
      >
        <div className="text-left">
          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Aumentar Score</p>
          <p className="text-sm font-black text-white uppercase italic tracking-tighter">Focar em Metas</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </button>
    </div>
  );
};

export default HealthScoreTab;
