
import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, CategoryLimit, SavingGoal, Note } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  categoryLimits: CategoryLimit[];
  goals: SavingGoal[];
  notes: Note[];
  globalBudget: number;
  onSetLimit: (config: { category: string; amount: number }) => void;
  onRemoveLimit: (category: string) => void;
  onUpdateBudget: (amount: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions = [],
  categoryLimits = [],
  globalBudget = 0,
  onSetLimit,
  onRemoveLimit,
  onUpdateBudget
}) => {
  const [isManagingLimits, setIsManagingLimits] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [newLimitCat, setNewLimitCat] = useState('');
  const [newLimitVal, setNewLimitVal] = useState('');

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthT = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = currentMonthT.filter(t => t.type === 'INCOME').reduce((s, t) => s + (t.amount || 0), 0);
    const expense = currentMonthT.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (t.amount || 0), 0);
    const balance = income - expense;

    const categories = Array.from(new Set(transactions.map(t => t.category))).filter(Boolean);
    const detailedExpenses = categories.map(cat => {
      const currentVal = currentMonthT
        .filter(t => t.category === cat && t.type === 'EXPENSE')
        .reduce((s, t) => s + (t.amount || 0), 0);
      
      return {
        name: cat,
        total: currentVal,
        percentOfTotal: expense > 0 ? (currentVal / expense) * 100 : 0
      };
    }).filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total);

    const budgetPercent = globalBudget > 0 ? Math.min((expense / globalBudget) * 100, 100) : 0;

    const categoryLimitStats = categoryLimits.map(limit => {
      const spent = currentMonthT
        .filter(t => t.category === limit.category && t.type === 'EXPENSE')
        .reduce((s, t) => s + (t.amount || 0), 0);
      return {
        ...limit,
        spent,
        percent: Math.min((spent / limit.amount) * 100, 100)
      };
    });

    // Sugestão de teto fixada em 80% do salário (income)
    const suggestedLimit = income > 0 ? income * 0.8 : 0;

    return { income, expense, balance, detailedExpenses, budgetPercent, categoryLimitStats, suggestedLimit };
  }, [transactions, globalBudget, categoryLimits]);

  useEffect(() => {
    // Só mostramos a sugestão se o teto for 0 e o usuário tiver algum rendimento lançado
    if (globalBudget === 0 && stats.income > 0) {
      const timer = setTimeout(() => setShowSuggestion(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [globalBudget, stats.income]);

  const getStatusInfo = (percent: number) => {
    if (percent >= 100) return { label: 'Esgotado', color: 'text-rose-500', bg: 'bg-rose-500' };
    if (percent >= 80) return { label: 'Risco', color: 'text-orange-500', bg: 'bg-orange-500' };
    if (percent >= 50) return { label: 'Alerta', color: 'text-amber-500', bg: 'bg-amber-500' };
    return { label: 'Ok', color: 'text-emerald-500', bg: 'bg-emerald-500' };
  };

  const budgetInfo = getStatusInfo(stats.budgetPercent);

  const handleAddLimit = () => {
    if (newLimitVal) {
      if (!newLimitCat || newLimitCat.toLowerCase() === 'geral') {
        onUpdateBudget(Number(newLimitVal));
      } else {
        onSetLimit({ category: newLimitCat, amount: Number(newLimitVal) });
      }
      setNewLimitCat('');
      setNewLimitVal('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto no-scrollbar p-6 space-y-6 pb-32">
      {/* Questionário de Sugestão de Teto de Gastos */}
      {showSuggestion && (
        <div className="fixed inset-0 z-[2000] bg-slate-950 flex items-center justify-center p-8 animate-in fade-in duration-500">
          <div className="absolute inset-0 opacity-5 pointer-events-none whatsapp-bg"></div>
          <div className="relative z-10 w-full max-w-sm text-center">
            <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl text-3xl">🛡️</div>
            
            <h2 className="text-3xl font-black mb-4 italic tracking-tighter text-white leading-tight uppercase">Definir teto geral de gastos</h2>
            
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-[2rem] border border-white/10 mb-8 text-left">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">Proposta: Teto de 80%</p>
              <p className="text-sm text-white/80 font-medium leading-relaxed mb-4">
                O GB sugere um teto de <span className="text-white font-bold">{currencyFormatter.format(stats.suggestedLimit)}</span> para suas despesas mensais.
              </p>
              <div className="text-[11px] text-white/60 font-medium leading-relaxed space-y-2">
                <p><span className="text-emerald-400 font-bold">Por que esse valor?</span></p>
                <p>Pesquisas indicam que os maiores gastos humanos são <span className="text-white font-bold">Moradia (Aluguel), Alimentação (Mercado) e Utilidades (Água/Luz)</span>.</p>
                <p>Reservar 80% para o custo de vida permite que você mantenha esses pilares em dia, enquanto guarda 20% para sua segurança e metas futuras.</p>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => { onUpdateBudget(stats.suggestedLimit); setShowSuggestion(false); }}
                className="w-full bg-emerald-500 text-white font-black py-5 rounded-[2rem] shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-[11px]"
              >
                Aceitar Teto Sugerido (80%)
              </button>
              <button 
                onClick={() => setShowSuggestion(false)}
                className="w-full text-white/40 font-black py-3 text-[10px] uppercase tracking-widest hover:text-white transition-colors"
              >
                Vou definir manualmente
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tighter italic">Painel de Controle</h2>
          <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest mt-1">Monitoramento de Consumo</p>
        </div>
        <button 
          onClick={() => setIsManagingLimits(true)}
          className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
        >
          Limites
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card de Saldo */}
        <div className="bg-slate-950 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[180px]">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Saldo Líquido Atual</p>
          <h3 className={`text-4xl font-black italic tracking-tighter ${stats.balance >= 0 ? 'text-white' : 'text-rose-400'}`}>
            {currencyFormatter.format(stats.balance)}
          </h3>
          <div className="flex gap-6 mt-6">
            <div>
               <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Receitas</p>
               <p className="text-sm font-black text-white">{currencyFormatter.format(stats.income)}</p>
            </div>
            <div>
               <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">Despesas</p>
               <p className="text-sm font-black text-white">{currencyFormatter.format(stats.expense)}</p>
            </div>
          </div>
        </div>

        {/* Orçamento Global */}
        <div className="p-8 rounded-[3rem] shadow-sm bg-white border border-gray-100 flex flex-col justify-center min-h-[180px]">
           {globalBudget > 0 ? (
             <>
               <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teto geral de gastos</p>
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full border ${budgetInfo.color} bg-white shadow-sm`}>
                    {budgetInfo.label} ({stats.budgetPercent.toFixed(0)}%)
                  </span>
               </div>
               <div className="flex justify-between items-end mb-3">
                  <h4 className={`text-3xl font-black italic tracking-tighter ${budgetInfo.color}`}>
                    {currencyFormatter.format(stats.expense)}
                  </h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Teto: {currencyFormatter.format(globalBudget)}</p>
               </div>
               <div className="w-full h-2.5 bg-gray-50 rounded-full overflow-hidden p-0.5 border border-gray-100">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${budgetInfo.bg}`}
                    style={{ width: `${stats.budgetPercent}%` }}
                  />
               </div>
             </>
           ) : (
             <div className="text-center py-4">
               <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 italic">Nenhum limite estabelecido</p>
               <button 
                 onClick={() => setIsManagingLimits(true)}
                 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest border border-emerald-100 px-4 py-2 rounded-xl bg-emerald-50 active:scale-95 transition-all"
               >
                 + Definir teto geral de gastos
               </button>
             </div>
           )}
        </div>
      </div>

      {/* Top Gastos do Mês */}
      <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-gray-100">
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-8">Raio-X de Consumo</h3>
        <div className="space-y-6">
          {stats.detailedExpenses.length > 0 ? stats.detailedExpenses.slice(0, 5).map((expense, idx) => (
            <div key={expense.name} className="animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
              <div className="flex justify-between items-center mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-900"></div>
                  <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{expense.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{currencyFormatter.format(expense.total)}</p>
                  <p className="text-[8px] font-black text-gray-400 uppercase">{expense.percentOfTotal.toFixed(1)}% do consumo total</p>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-900 rounded-full transition-all duration-1000"
                  style={{ width: `${expense.percentOfTotal}%` }}
                />
              </div>
            </div>
          )) : (
            <div className="py-12 text-center border-2 border-dashed border-gray-50 rounded-3xl">
               <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest italic">Aguardando registros de saída...</p>
            </div>
          )}
        </div>
      </div>

      {/* Metas por Segmento */}
      <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-gray-100">
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6">Limites por Segmento</h3>
        <div className="space-y-6">
          {stats.categoryLimitStats.length > 0 ? stats.categoryLimitStats.map((limit, idx) => {
            const info = getStatusInfo(limit.percent);
            return (
              <div key={limit.category} className="animate-in slide-in-from-left" style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="flex justify-between items-center mb-2 px-1">
                  <div>
                    <span className="text-sm font-black text-slate-800">{limit.category}</span>
                    <span className={`ml-2 text-[8px] font-black uppercase ${info.color}`}>{info.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-900">
                      {currencyFormatter.format(limit.spent)} <span className="text-gray-300 font-bold">/ {currencyFormatter.format(limit.amount)}</span>
                    </p>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${info.bg}`}
                    style={{ width: `${limit.percent}%` }}
                  />
                </div>
              </div>
            );
          }) : (
            <div className="py-6 text-center border-2 border-dashed border-gray-50 rounded-3xl">
               <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest italic">Sem limites de categoria definidos.</p>
               <button 
                onClick={() => setIsManagingLimits(true)}
                className="text-[8px] text-emerald-400 font-bold mt-1 uppercase"
               >
                 + Adicionar Limite Manual
               </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Gestão de Limites */}
      {isManagingLimits && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in border border-gray-100">
            <button onClick={() => setIsManagingLimits(false)} className="absolute top-6 right-6 p-2 bg-gray-50 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h3 className="text-xl font-black text-gray-900 mb-6 tracking-tighter italic text-center">Gestão de Limites</h3>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Novo Limite</p>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-xs outline-none focus:border-emerald-500 font-medium"
                    placeholder="Categoria (ou Geral)"
                    value={newLimitCat}
                    onChange={e => setNewLimitCat(e.target.value)}
                  />
                  <input 
                    type="number"
                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-xs outline-none focus:border-emerald-500 font-medium"
                    placeholder="Valor R$"
                    value={newLimitVal}
                    onChange={e => setNewLimitVal(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleAddLimit}
                  className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Confirmar Limite
                </button>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-50">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Limites Ativos</p>
                <div className="max-h-48 overflow-y-auto no-scrollbar space-y-2">
                  {/* Limite Geral */}
                  {globalBudget > 0 && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">Geral</p>
                        <p className="text-xs font-bold text-emerald-600">{currencyFormatter.format(globalBudget)}</p>
                      </div>
                      <button 
                        onClick={() => onUpdateBudget(0)}
                        className="p-2 bg-rose-50 text-rose-300 rounded-xl hover:text-rose-600 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {/* Limites por Categoria */}
                  {categoryLimits.map(l => (
                    <div key={l.category} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-2xl">
                      <div>
                        <p className="text-[10px] font-black text-slate-800 uppercase">{l.category}</p>
                        <p className="text-xs font-bold text-slate-500">{currencyFormatter.format(l.amount)}</p>
                      </div>
                      <button 
                        onClick={() => onRemoveLimit(l.category)}
                        className="p-2 bg-rose-50 text-rose-300 rounded-xl hover:text-rose-600 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {globalBudget === 0 && categoryLimits.length === 0 && (
                    <p className="text-[9px] text-gray-300 text-center italic py-4">Nenhum limite configurado.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
