
import React, { useMemo } from 'react';
import { Transaction } from '../types';

interface InvestmentsProps {
  transactions: Transaction[];
  availableBalance: number;
}

const Investments: React.FC<InvestmentsProps> = ({ transactions, availableBalance }) => {
  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const stats = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'EXPENSE');
    const categoryTotals: { [key: string]: number } = {};
    expenses.forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + (t.amount || 0);
    });
    
    // Identifica os maiores gastos (Top 3)
    const sortedExpenses = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const topVillain = sortedExpenses[0] ? { name: sortedExpenses[0][0], amount: sortedExpenses[0][1] } : null;

    // Simulação de corte de 30% no maior gasto
    const potentialSaving = topVillain ? topVillain.amount * 0.3 : 0;
    const recommendedInvest = Math.max(0, availableBalance + potentialSaving);

    return { topVillain, potentialSaving, recommendedInvest, sortedExpenses };
  }, [transactions, availableBalance]);

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#f8fafc] no-scrollbar pb-32 space-y-8">
      <div className="bg-slate-900 p-10 rounded-b-[4rem] -mx-6 -mt-6 shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Sobras do Dashboard</p>
        <h2 className="text-5xl font-black text-white tracking-tighter">
          {currencyFormatter.format(availableBalance)}
        </h2>
        {stats.topVillain && (
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">
             <span className="text-emerald-400 text-[10px] font-black uppercase">Potencial com cortes:</span>
             <span className="text-white text-xs font-black">{currencyFormatter.format(stats.recommendedInvest)}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Estratégia de Investimento</h3>
        <div className="bg-white p-8 rounded-[3.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
           {stats.topVillain ? (
             <>
               <p className="text-sm font-bold text-slate-800 leading-tight">
                 Ao otimizar em <span className="text-rose-500">30%</span> seus gastos com <span className="uppercase">{stats.topVillain.name}</span>...
               </p>
               <div className="my-8 flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Resgate Mensal</p>
                    <p className="text-lg font-black text-emerald-600">+{currencyFormatter.format(stats.potentialSaving)}</p>
                  </div>
                  <div className="h-10 w-px bg-gray-100"></div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Sugestão de Aporte</p>
                    <p className="text-lg font-black text-slate-900">{currencyFormatter.format(stats.recommendedInvest)}</p>
                  </div>
               </div>
               <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-700 leading-relaxed italic">
                    "O GB sugere aplicar {currencyFormatter.format(stats.recommendedInvest)} em ativos de liquidez diária até formar sua reserva."
                  </p>
               </div>
             </>
           ) : (
             <div className="text-center py-6 opacity-40">
                <p className="text-xs font-black uppercase tracking-widest">Aguardando dados de consumo</p>
             </div>
           )}
        </div>
      </div>

      <div className="space-y-4">
         <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ranking de Consumo Atual</h3>
         <div className="space-y-3">
            {stats.sortedExpenses.slice(0, 3).map(([cat, val], idx) => (
              <div key={cat} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400">{idx+1}</div>
                    <span className="text-sm font-black text-slate-800 uppercase italic tracking-tighter">{cat}</span>
                 </div>
                 <p className="text-sm font-black text-rose-500">{currencyFormatter.format(val)}</p>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default Investments;
