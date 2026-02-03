
import React, { useMemo } from 'react';
import { Transaction } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  budget: number;
}

const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const currency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="p-6 md:p-12 space-y-10 overflow-y-auto h-full no-scrollbar pb-24 bg-[#f8fafc] page-transition">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard</h2>
          <p className="text-[12px] text-gray-500 font-medium uppercase tracking-wider">Gestão Executiva • Premium</p>
        </div>
        <div className="bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-gray-100 text-[11px] font-bold text-gray-600 uppercase tracking-widest">
          {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#111b21] p-10 rounded-[32px] shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#00a884]/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Patrimônio Líquido</p>
            <h3 className="text-5xl font-extrabold tracking-tighter mb-10">{currency(stats.balance)}</h3>
            
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Entradas Totais</p>
                <p className="text-2xl font-bold text-[#00a884]">{currency(stats.income)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Despesas Acumuladas</p>
                <p className="text-2xl font-bold text-rose-400">{currency(stats.expense)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="premium-card p-10 flex flex-col justify-center text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
             <span className="text-2xl">🎯</span>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status da Meta</p>
          <h4 className="text-lg font-extrabold text-gray-900">Poupar 20%</h4>
          <div className="w-full h-2.5 bg-gray-100 rounded-full mt-6 overflow-hidden">
             <div className="h-full bg-[#00a884] w-[65%] rounded-full shadow-sm transition-all duration-700"></div>
          </div>
          <p className="text-[10px] font-bold text-[#00a884] mt-3 uppercase tracking-widest">Em progresso</p>
        </div>
      </div>

      {/* Details Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="premium-card p-8">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-widest">Fluxo Recente</h4>
            <span className="text-[10px] font-bold text-[#00a884] bg-emerald-50 px-3 py-1.5 rounded-xl uppercase">Análise Top 3</span>
          </div>
          <div className="space-y-6">
            {transactions.filter(t => t.type === 'EXPENSE').slice(0, 3).map(t => (
              <div key={t.id} className="flex justify-between items-center hover:translate-x-1 transition-transform cursor-default">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-gray-50 flex items-center justify-center text-xl">
                    {t.category === 'Alimentação' ? '🍕' : t.category === 'Transporte' ? '🚗' : '📦'}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-800 block leading-tight">{t.description}</span>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{t.category}</span>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-gray-900">{currency(t.amount)}</span>
              </div>
            ))}
            {transactions.filter(t => t.type === 'EXPENSE').length === 0 && (
              <div className="text-center py-10 opacity-30 italic text-sm">Sem movimentações pendentes.</div>
            )}
          </div>
        </div>

        <div className="bg-[#00a884] p-10 rounded-[32px] shadow-lg text-white flex flex-col justify-center text-center relative overflow-hidden">
           <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/10 to-transparent"></div>
           <div className="relative z-10">
              <div className="text-4xl mb-6">💎</div>
              <h3 className="text-xl font-extrabold mb-3 tracking-tight">Insight de Gestão</h3>
              <p className="text-[13px] font-medium leading-relaxed opacity-90 max-w-[240px] mx-auto mb-8">
                "Você reduziu custos com lazer em 12% este mês. Excelente trabalho de auditoria!"
              </p>
              <button className="bg-white text-[#00a884] py-3.5 px-8 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-md active:scale-95 transition-all hover:shadow-lg">
                Gerar Relatório Completo
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
