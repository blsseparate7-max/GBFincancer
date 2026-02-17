import React, { useMemo, useState } from 'react';
import { Transaction, SavingGoal, CategoryLimit } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';

interface DashProps {
  transactions: Transaction[];
  goals: SavingGoal[];
  limits: CategoryLimit[];
  uid: string;
}

const Dashboard: React.FC<DashProps> = ({ transactions, goals, limits, uid }) => {
  const [showLimitModal, setShowLimitModal] = useState(false);
  
  const [limitCat, setLimitCat] = useState('');
  const [limitVal, setLimitVal] = useState('');

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const stats = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    
    const expense = transactions
      .filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    
    const totalSaved = goals.reduce((s, g) => s + (Number(g.currentAmount) || 0), 0);
    const sobra = income - expense;
    const saldoLivre = sobra - totalSaved;

    const sortedLimits = [...limits].sort((a, b) => {
      const pA = a.limit > 0 ? a.spent / a.limit : 0;
      const pB = b.limit > 0 ? b.spent / b.limit : 0;
      return pB - pA;
    });

    return { 
      income, expense, sobra, saldoLivre, totalSaved, sortedLimits 
    };
  }, [transactions, goals, limits]);

  const handleCreateLimit = async () => {
    if (!limitCat || !limitVal) return;
    await dispatchEvent(uid, {
      type: 'UPDATE_LIMIT',
      payload: { category: limitCat, amount: parseFloat(limitVal) },
      source: 'ui',
      createdAt: new Date()
    });
    setLimitCat(''); setLimitVal(''); setShowLimitModal(false);
  };

  return (
    <div className="p-6 space-y-8 animate-fade pb-32 h-full overflow-y-auto no-scrollbar relative z-10">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-[10px] font-black text-[#00a884] uppercase tracking-[0.4em] mb-1">Visão Geral</h2>
          <h1 className="text-3xl font-black text-[#e9edef] uppercase italic tracking-tighter">Dashboard</h1>
        </div>
        <div className="text-right pb-1">
          <p className="text-[9px] font-black text-[#8696a0] uppercase tracking-widest">Saldo em Conta</p>
          <p className={`text-xl font-black italic ${stats.saldoLivre < 0 ? 'text-red-500' : 'text-[#00a884]'}`}>{format(stats.saldoLivre)}</p>
        </div>
      </header>

      {/* Cards de Resumo */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#111b21] p-4 rounded-3xl border border-[#2a3942] shadow-sm">
          <p className="text-[8px] font-black text-[#8696a0] uppercase mb-1">Entradas</p>
          <h3 className="text-sm font-black text-[#00a884]">{format(stats.income)}</h3>
        </div>
        <div className="bg-[#111b21] p-4 rounded-3xl border border-[#2a3942] shadow-sm">
          <p className="text-[8px] font-black text-[#8696a0] uppercase mb-1">Saídas Reais</p>
          <h3 className="text-sm font-black text-rose-500">{format(stats.expense)}</h3>
        </div>
        <div className="bg-[#202c33] p-4 rounded-3xl shadow-xl text-[#e9edef] border border-[#2a3942]">
          <p className="text-[8px] font-black text-[#8696a0] uppercase mb-1">Livre agora</p>
          <h3 className="text-sm font-black text-[#25D366]">{format(stats.saldoLivre)}</h3>
        </div>
        <div className="bg-[#005c4b]/20 p-4 rounded-3xl border border-[#00a884]/20 text-[#00a884]">
          <p className="text-[8px] font-black uppercase mb-1 opacity-70">Em Cofres</p>
          <h3 className="text-sm font-black">{format(stats.totalSaved)}</h3>
        </div>
      </section>

      {/* Limites */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest italic">Controle de Tetos</h3>
          <button onClick={() => setShowLimitModal(true)} className="text-[9px] font-bold text-[#00a884] uppercase">+ Novo Limite</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.sortedLimits.map(lim => {
            const pct = lim.limit > 0 ? Math.min(100, (lim.spent / lim.limit) * 100) : 0;
            return (
              <div key={lim.id} className="bg-[#111b21] p-5 rounded-[2rem] border border-[#2a3942] shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-black text-[#e9edef] uppercase">{lim.category}</h4>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${pct >= 100 ? 'bg-red-500 text-white' : pct >= 80 ? 'bg-amber-400/20 text-amber-500' : 'bg-[#00a884]/20 text-[#00a884]'}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-[#0b141a] rounded-full overflow-hidden mb-2">
                  <div className={`h-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-[#00a884]'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-[#8696a0]">
                  <span>Gasto: {format(lim.spent)}</span>
                  <span>Meta: {format(lim.limit)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal Limite */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#111b21] w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative border border-[#2a3942] animate-fade">
            <button onClick={() => setShowLimitModal(false)} className="absolute top-8 right-8 text-[#8696a0] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[#e9edef] uppercase italic mb-6">Configurar Teto</h3>
            <div className="space-y-4">
              <input className="w-full bg-[#202c33] rounded-xl p-4 text-sm font-bold text-[#e9edef] outline-none border border-transparent focus:border-[#00a884]" placeholder="Categoria (Ex: Lanche)" value={limitCat} onChange={e => setLimitCat(e.target.value)} />
              <input type="number" className="w-full bg-[#202c33] rounded-xl p-4 text-sm font-bold text-[#e9edef] outline-none border border-transparent focus:border-[#00a884]" placeholder="Limite R$" value={limitVal} onChange={e => setLimitVal(e.target.value)} />
              <button onClick={handleCreateLimit} className="w-full bg-[#00a884] text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-lg mt-4">Ativar Teto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;