
import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, SavingGoal } from '../types';

interface ReportsProps {
  transactions: Transaction[];
  goals: SavingGoal[];
}

const Reports: React.FC<ReportsProps> = ({ transactions, goals }) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const availableCategories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category));
    return Array.from(cats).sort();
  }, [transactions]);

  const yearlyStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const filteredSource = transactions.filter(t => {
      const matchCat = filterCategory === 'ALL' || t.category === filterCategory;
      const matchType = filterType === 'ALL' || t.type === filterType;
      return matchCat && matchType;
    });

    const stats = months.map((month, index) => {
      const monthTransactions = filteredSource.filter(t => {
        const date = new Date(t.date);
        return date.getFullYear() === currentYear && date.getMonth() === index;
      });
      const income = monthTransactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + (t.amount || 0), 0);
      const expense = monthTransactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + (t.amount || 0), 0);
      const goalsSavings = monthTransactions.filter(t => t.type === 'SAVING').reduce((sum, t) => sum + (t.amount || 0), 0);
      return { month, income, expense, goalsSavings, balance: income - expense - goalsSavings, totalVolume: income + expense + goalsSavings, hasData: monthTransactions.length > 0 };
    });
    const dataOnly = stats.filter(s => s.hasData);
    let mostActiveMonth = dataOnly.length > 0 ? dataOnly.reduce((prev, curr) => (curr.totalVolume > prev.totalVolume) ? curr : prev) : null;
    let leastActiveMonth = dataOnly.length > 0 ? dataOnly.reduce((prev, curr) => (curr.totalVolume < prev.totalVolume) ? curr : prev) : null;
    let gapValue = (mostActiveMonth && leastActiveMonth) ? mostActiveMonth.totalVolume - leastActiveMonth.totalVolume : 0;
    return { stats, mostActiveMonth, leastActiveMonth, gapValue };
  }, [transactions, filterCategory, filterType]);

  const exportToExcel = () => {
    // Standard CSV using Comma and BOM (Byte Order Mark) for Excel UTF-8 compatibility
    let csvContent = "Mes,Entradas,Saidas,Metas,Saldo\n";
    yearlyStats.stats.forEach(s => {
      csvContent += `${s.month},${s.income.toFixed(2)},${s.expense.toFixed(2)},${s.goalsSavings.toFixed(2)},${s.balance.toFixed(2)}\n`;
    });
    const BOM = "\ufeff";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Relatorio_GB_${new Date().getFullYear()}.csv`;
    link.click();
  };

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="p-6 h-full overflow-y-auto bg-[#f8fafc] no-scrollbar pb-32">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic">Relatórios</h2>
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Análise de Performance {new Date().getFullYear()}</p>
        </div>
        <button onClick={exportToExcel} className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2 active:scale-90 transition-transform hover:bg-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span className="text-[9px] font-black uppercase tracking-widest">Excel</span>
        </button>
      </div>

      <div className="space-y-4 mb-8">
        <div>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Filtrar por Categoria</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button onClick={() => setFilterCategory('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${filterCategory === 'ALL' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>Todas</button>
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${filterCategory === cat ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{cat}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Tipo de Fluxo</p>
          <div className="flex gap-2">
            {[{ id: 'ALL', label: 'Todos' }, { id: 'INCOME', label: 'Entradas' }, { id: 'EXPENSE', label: 'Saídas' }, { id: 'SAVING', label: 'Metas' }].map(type => (
              <button key={type.id} onClick={() => setFilterType(type.id as any)} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterType === type.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{type.label}</button>
            ))}
          </div>
        </div>
      </div>

      {yearlyStats.mostActiveMonth && yearlyStats.leastActiveMonth && yearlyStats.gapValue > 0 ? (
        <div className="bg-slate-950 text-white p-8 rounded-[3rem] shadow-2xl mb-8 relative overflow-hidden animate-in zoom-in duration-500">
           <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16"></div>
           <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Diagnóstico de Oscilação</p>
           <h3 className="text-xl font-black mb-2 leading-tight">Variação Extremas de Fluxo:</h3>
           <p className="text-3xl font-black text-emerald-400 mb-4">{currencyFormatter.format(yearlyStats.gapValue)}</p>
           <div className="flex items-center gap-2 text-[10px] font-bold opacity-60">
             <span className="text-emerald-400">●</span> Pico: {yearlyStats.mostActiveMonth.month}
             <span className="text-rose-400 ml-2">●</span> Mínimo: {yearlyStats.leastActiveMonth.month}
           </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {yearlyStats.stats.map((s) => (
          <div key={s.month} className={`bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all ${!s.hasData ? 'opacity-30' : 'hover:shadow-lg active:scale-[0.98]'}`}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-black text-gray-800 text-sm uppercase">{s.month}</h4>
              <span className={`text-xs font-black ${s.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{s.hasData ? currencyFormatter.format(s.balance) : 'Sem dados'}</span>
            </div>
            {s.hasData && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50/50 p-2 rounded-xl"><p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Entradas</p><p className="text-[10px] font-black text-emerald-600 truncate">{currencyFormatter.format(s.income)}</p></div>
                <div className="bg-gray-50/50 p-2 rounded-xl"><p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Saídas</p><p className="text-[10px] font-black text-rose-600 truncate">{currencyFormatter.format(s.expense)}</p></div>
                <div className="bg-gray-50/50 p-2 rounded-xl"><p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Metas</p><p className="text-[10px] font-black text-blue-600 truncate">{currencyFormatter.format(s.goalsSavings)}</p></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reports;
