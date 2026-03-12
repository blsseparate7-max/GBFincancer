
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
    <div className="p-6 min-h-full bg-[var(--bg-body)] pb-32 space-y-8">
      <div className="bg-[var(--surface)] p-10 rounded-b-[4rem] -mx-6 -mt-6 shadow-2xl relative overflow-hidden text-center border-b border-[var(--border)]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--green-whatsapp)]/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest mb-2">Sobras do Dashboard</p>
        <h2 className="text-5xl font-black text-[var(--text-primary)] tracking-tighter">
          {currencyFormatter.format(availableBalance)}
        </h2>
        {stats.topVillain && (
          <div className="mt-4 inline-flex items-center gap-2 bg-[var(--green-whatsapp)]/10 px-4 py-1.5 rounded-full border border-[var(--green-whatsapp)]/20">
             <span className="text-[var(--green-whatsapp)] text-[10px] font-black uppercase">Potencial com cortes:</span>
             <span className="text-[var(--text-primary)] text-xs font-black">{currencyFormatter.format(stats.recommendedInvest)}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Estratégia de Investimento</h3>
        <div className="bg-[var(--surface)] p-8 rounded-[3.5rem] border border-[var(--border)] shadow-sm relative overflow-hidden">
           {stats.topVillain ? (
             <>
               <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                 Ao otimizar em <span className="text-rose-500">30%</span> seus gastos com <span className="uppercase">{stats.topVillain.name}</span>...
               </p>
               <div className="my-8 flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1 tracking-widest">Resgate Mensal</p>
                    <p className="text-lg font-black text-[var(--green-whatsapp)]">+{currencyFormatter.format(stats.potentialSaving)}</p>
                  </div>
                  <div className="h-10 w-px bg-[var(--border)]"></div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1 tracking-widest">Sugestão de Aporte</p>
                    <p className="text-lg font-black text-[var(--text-primary)]">{currencyFormatter.format(stats.recommendedInvest)}</p>
                  </div>
               </div>
               <div className="bg-[var(--green-whatsapp)]/10 p-6 rounded-3xl border border-[var(--green-whatsapp)]/20">
                  <p className="text-xs font-bold text-[var(--green-whatsapp)] leading-relaxed italic">
                    "O GB sugere aplicar {currencyFormatter.format(stats.recommendedInvest)} em ativos de liquidez diária até formar sua reserva."
                  </p>
               </div>
             </>
           ) : (
             <div className="text-center py-6 opacity-40">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Aguardando dados de consumo</p>
             </div>
           )}
        </div>
      </div>

      <div className="space-y-4">
         <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Ranking de Consumo Atual</h3>
         <div className="space-y-3">
            {stats.sortedExpenses.slice(0, 3).map(([cat, val], idx) => (
              <div key={cat} className="bg-[var(--surface)] p-5 rounded-[2.5rem] shadow-sm border border-[var(--border)] flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--bg-body)] flex items-center justify-center text-xs font-black text-[var(--text-muted)]">{idx+1}</div>
                    <span className="text-sm font-black text-[var(--text-primary)] uppercase italic tracking-tighter">{cat}</span>
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
