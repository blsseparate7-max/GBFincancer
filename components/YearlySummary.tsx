
import React, { useMemo } from 'react';
import { Transaction, SavingGoal, Wallet } from '../types';
import ChartNetWorth from './ChartNetWorth';

interface YearlySummaryProps {
  transactions: Transaction[];
  goals: SavingGoal[];
  wallets: Wallet[];
}

const YearlySummary: React.FC<YearlySummaryProps> = ({ transactions, goals, wallets }) => {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const yearData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const data = months.map((monthName, index) => {
      const monthTrans = transactions.filter(t => {
        const d = new Date(t.date || t.createdAt?.seconds * 1000);
        return d.getMonth() === index && d.getFullYear() === currentYear;
      });

      const income = monthTrans.filter(t => t.type === 'INCOME').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const expense = monthTrans.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const balance = income - expense;

      return { name: monthName, income, expense, balance, hasData: monthTrans.length > 0 };
    });

    const totalIncome = data.reduce((s, m) => s + m.income, 0);
    const totalExpense = data.reduce((s, m) => s + m.expense, 0);

    return { monthly: data, totalIncome, totalExpense, totalBalance: totalIncome - totalExpense };
  }, [transactions]);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="p-6 space-y-6 animate-fade pb-32">
      <header className="mb-8">
        <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Performance Consolidada</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Resumo Anual {new Date().getFullYear()}</h1>
      </header>

      {/* Gráfico de Evolução */}
      <div className="mb-8">
        <ChartNetWorth transactions={transactions} goals={goals} wallets={wallets} />
      </div>

      {/* Totais do Ano */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Acumulado Entradas</p>
          <h4 className="text-xl font-black text-[var(--green-whatsapp)]">{format(yearData.totalIncome)}</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Acumulado Saídas</p>
          <h4 className="text-xl font-black text-[#ef4444]">{format(yearData.totalExpense)}</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">Patrimônio Líquido Gerado</p>
          <h4 className="text-xl font-black text-[var(--text-primary)]">{format(yearData.totalBalance)}</h4>
        </div>
      </div>

      {/* Grid de 12 Meses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {yearData.monthly.map((m, idx) => (
          <div key={idx} className={`bg-white p-5 rounded-3xl border transition-all ${m.hasData ? 'border-[var(--border)] shadow-sm' : 'border-dashed border-gray-200 opacity-50'}`}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black uppercase italic text-[var(--text-primary)]">{m.name}</span>
              {m.hasData && (
                <div className={`w-2 h-2 rounded-full ${m.balance >= 0 ? 'bg-[var(--green-whatsapp)]' : 'bg-red-500'}`}></div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-[var(--text-muted)]">ENTRADAS</span>
                <span className="text-[var(--green-whatsapp)]">{format(m.income)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-[var(--text-muted)]">SAÍDAS</span>
                <span className="text-[#ef4444]">{format(m.expense)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[9px] font-black text-[var(--text-primary)] uppercase">Saldo</span>
                <span className={`text-sm font-black ${m.balance >= 0 ? 'text-[var(--text-primary)]' : 'text-red-500'}`}>
                  {format(m.balance)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default YearlySummary;
