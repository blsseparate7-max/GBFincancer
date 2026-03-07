
import React, { useMemo } from 'react';
import { Transaction, SavingGoal } from '../types';

interface ReportsProps {
  transactions: Transaction[];
  goals: SavingGoal[];
}

const Reports: React.FC<ReportsProps> = ({ transactions }) => {
  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const reportData = useMemo(() => {
    // Cálculo de balanço real a partir do zero
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      
    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    
    const monthlyGroups: Record<string, { income: number; expense: number }> = {};
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      if (!monthlyGroups[key]) monthlyGroups[key] = { income: 0, expense: 0 };
      
      if (t.type === 'INCOME') monthlyGroups[key].income += (Number(t.amount) || 0);
      else if (t.type === 'EXPENSE') monthlyGroups[key].expense += (Number(t.amount) || 0);
    });

    return { totalIncome, totalExpense, balance: totalIncome - totalExpense, monthlyGroups };
  }, [transactions]);

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full pb-32 bg-[#f8fafc] animate-fade">
      <header className="mb-2">
        <h2 className="text-[10px] font-black text-[#008069] uppercase tracking-[0.4em] mb-1">Auditoria Histórica</h2>
        <h1 className="text-3xl font-black text-[#111b21] uppercase italic tracking-tighter">Relatórios</h1>
      </header>

      <div className="bg-[#111b21] p-8 rounded-[3rem] shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#008069]/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <p className="text-[10px] font-black text-[#008069] uppercase tracking-widest mb-1">Balanço Acumulado Real</p>
        <h3 className="text-4xl font-black tracking-tighter">{format(reportData.balance)}</h3>
        
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
          <div>
            <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Ganhos Reais</p>
            <p className="text-sm font-black text-emerald-400">+{format(reportData.totalIncome)}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Gastos Reais</p>
            <p className="text-sm font-black text-rose-400">-{format(reportData.totalExpense)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mt-6">Histórico Mensal</h3>
        {Object.keys(reportData.monthlyGroups).length > 0 ? (
          Object.entries(reportData.monthlyGroups)
            .sort((a, b) => {
               const [monthA, yearA] = a[0].split(' ');
               const [monthB, yearB] = b[0].split(' ');
               return new Date(`${monthB} 1, ${yearB}`).getTime() - new Date(`${monthA} 1, ${yearA}`).getTime();
            })
            .map(([month, val]) => {
              const data = val as { income: number; expense: number };
              const mBalance = data.income - data.expense;
              
              return (
                <div key={month} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex justify-between items-center group hover:border-[#008069] transition-all">
                  <div>
                    <span className="text-xs font-black uppercase italic text-[#111b21]">{month}</span>
                    <div className="flex gap-3 mt-1">
                       <span className="text-[9px] font-bold text-emerald-500">+{format(data.income)}</span>
                       <span className="text-[9px] font-bold text-rose-400">-{format(data.expense)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-black block tracking-tighter ${mBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {format(mBalance)}
                    </span>
                    <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Saldo Mensal</span>
                  </div>
                </div>
              );
            })
        ) : (
          <div className="text-center py-24 bg-white rounded-[3rem] border border-gray-100 px-12">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl opacity-30">📋</div>
             <p className="text-[10px] font-black text-gray-400 uppercase italic tracking-widest leading-relaxed">
               Nenhuma transação encontrada. Registre sua primeira movimentação no Mentor IA para gerar relatórios.
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
