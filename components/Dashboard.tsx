import React, { useMemo, useState } from 'react';
import { Transaction, SavingGoal, CategoryLimit } from '../types';
import { dispatchEvent } from '../services/eventDispatcher';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, PieChart as PieIcon, BarChart3 } from 'lucide-react';

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

  const normalizeCategory = (cat: string) => {
    const c = cat.toUpperCase().trim();
    if (['LANCHE', 'LANCHES', 'COMIDA', 'RESTAURANTE', 'IFOOD', 'ALIMENTAÇÃO', 'ALIMENTACAO'].includes(c)) return 'ALIMENTAÇÃO';
    if (['UBER', '99', 'GASOLINA', 'COMBUSTIVEL', 'TRANSPORTE', 'TRANSP'].includes(c)) return 'TRANSPORTE';
    if (['ALUGUEL', 'CONDOMINIO', 'LUZ', 'AGUA', 'INTERNET', 'MORADIA'].includes(c)) return 'MORADIA';
    if (['FARMACIA', 'MEDICO', 'SAUDE', 'SAÚDE', 'ACADEMIA'].includes(c)) return 'SAÚDE';
    if (['ESCOLA', 'CURSO', 'FACULDADE', 'EDUCAÇÃO', 'EDUCACAO'].includes(c)) return 'EDUCAÇÃO';
    if (['CINEMA', 'LAZER', 'VIAGEM', 'SHOW'].includes(c)) return 'LAZER';
    if (['ROUPA', 'BELEZA', 'PESSOAL', 'PET'].includes(c)) return 'PESSOAL';
    if (['INVESTIMENTO', 'BANCO', 'JUROS', 'FINANCEIRO'].includes(c)) return 'FINANCEIRO';
    return c;
  };

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

    const incomeCategories = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((acc, t) => {
        const cat = normalizeCategory(t.category || 'Outros');
        acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
        return acc;
      }, {} as Record<string, number>);

    const expenseCategories = transactions
      .filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD')
      .reduce((acc, t) => {
        const cat = normalizeCategory(t.category || 'Outros');
        acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
        return acc;
      }, {} as Record<string, number>);

    const sortedLimits = [...limits].sort((a, b) => {
      const pA = a.limit > 0 ? a.spent / a.limit : 0;
      const pB = b.limit > 0 ? b.spent / b.limit : 0;
      return pB - pA;
    });

    const barData = [
      { name: 'Entradas', value: income, color: '#00a884' },
      { name: 'Saídas', value: expense, color: '#f43f5e' }
    ];
    const pieData = Object.entries(expenseCategories).map(([name, value]) => ({
      name,
      value: value as number
    })).sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 5);

    return { 
      income, expense, sobra, saldoLivre, totalSaved, sortedLimits, incomeCategories, expenseCategories, barData, pieData 
    };
  }, [transactions, goals, limits]);

  const exportCSV = () => {
    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Método'];
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleDateString(),
      t.description,
      t.category,
      t.type,
      t.amount,
      t.paymentMethod
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `extrato_gbfinancer_${new Date().getMonth() + 1}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm("Excluir esta transação permanentemente?")) {
      await dispatchEvent(uid, {
        type: 'DELETE_ITEM',
        payload: { id, collection: 'transactions' },
        source: 'ui',
        createdAt: new Date()
      });
    }
  };

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
    <div className="p-6 space-y-8 animate-fade pb-32 relative z-10">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Visão Geral</h2>
          <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Dashboard</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={exportCSV}
            className="text-[9px] font-black text-[var(--green-whatsapp)] border border-[var(--green-whatsapp)]/30 px-3 py-1.5 rounded-full uppercase hover:bg-[var(--green-whatsapp)]/10 transition-all"
          >
            📥 Exportar CSV
          </button>
          <div className="text-right">
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Saldo em Conta</p>
            <p className={`text-xl font-black italic ${stats.saldoLivre < 0 ? 'text-red-500' : 'text-[var(--green-whatsapp)]'}`}>{format(stats.saldoLivre)}</p>
          </div>
        </div>
      </header>

      {/* Cards de Resumo */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[var(--surface)] p-4 rounded-3xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={10} className="text-[var(--green-whatsapp)]" />
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Entradas</p>
          </div>
          <h3 className="text-sm font-black text-[var(--green-whatsapp)]">{format(stats.income)}</h3>
        </div>
        <div className="bg-[var(--surface)] p-4 rounded-3xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={10} className="text-rose-500" />
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Saídas Reais</p>
          </div>
          <h3 className="text-sm font-black text-rose-500">{format(stats.expense)}</h3>
        </div>
        <div className="bg-[var(--bg-body)] p-4 rounded-3xl shadow-xl text-[var(--text-primary)] border border-[var(--border)]">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase mb-1">Livre agora</p>
          <h3 className="text-sm font-black text-[var(--green-whatsapp)]">{format(stats.saldoLivre)}</h3>
        </div>
        <div className="bg-[var(--green-whatsapp)]/10 p-4 rounded-3xl border border-[var(--green-whatsapp)]/20 text-[var(--green-whatsapp)]">
          <p className="text-[8px] font-black uppercase mb-1 opacity-70">Em Cofres</p>
          <h3 className="text-sm font-black">{format(stats.totalSaved)}</h3>
        </div>
      </section>

      {/* Gráficos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comparativo Entradas vs Saídas */}
        <div className="bg-[var(--surface)] p-6 rounded-[2rem] border border-[var(--border)] shadow-sm min-h-[300px] flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={14} className="text-[var(--green-whatsapp)]" />
            <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest italic">Comparativo Financeiro</h3>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.barData}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#667781', fontSize: 10, fontWeight: 'bold' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e9edef', borderRadius: '12px', fontSize: '10px' }}
                  itemStyle={{ fontWeight: 'bold' }}
                  formatter={(value: number) => [format(value), '']}
                />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {stats.barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição de Gastos */}
        <div className="bg-[var(--surface)] p-6 rounded-[2rem] border border-[var(--border)] shadow-sm min-h-[300px] flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <PieIcon size={14} className="text-rose-500" />
            <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest italic">Distribuição de Gastos</h3>
          </div>
          <div className="flex-1 w-full flex items-center justify-center">
            {stats.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fff1f2'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e9edef', borderRadius: '12px', fontSize: '10px' }}
                    formatter={(value: number) => [format(value), '']}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] italic">Sem dados de gastos para exibir.</p>
            )}
          </div>
        </div>
      </section>

      {/* Categorias de Entradas e Saídas */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entradas por Categoria */}
        <div className="bg-[var(--surface)] p-5 rounded-[2rem] border border-[var(--border)] shadow-sm">
          <h3 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest italic mb-4">Entradas por Categoria</h3>
          <div className="space-y-3">
            {Object.entries(stats.incomeCategories).length > 0 ? (
              Object.entries(stats.incomeCategories)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([cat, val]) => (
                  <div key={cat} className="flex justify-between items-center border-b border-[var(--border)]/30 pb-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{cat}</span>
                    <span className="text-xs font-black text-[var(--green-whatsapp)]">{format(val as number)}</span>
                  </div>
                ))
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] italic">Nenhuma entrada registrada.</p>
            )}
          </div>
        </div>

        {/* Saídas por Categoria */}
        <div className="bg-[var(--surface)] p-5 rounded-[2rem] border border-[var(--border)] shadow-sm">
          <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic mb-4">Saídas por Categoria</h3>
          <div className="space-y-3">
            {Object.entries(stats.expenseCategories).length > 0 ? (
              Object.entries(stats.expenseCategories)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([cat, val]) => (
                  <div key={cat} className="flex justify-between items-center border-b border-[var(--border)]/30 pb-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{cat}</span>
                    <span className="text-xs font-black text-rose-500">{format(val as number)}</span>
                  </div>
                ))
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] italic">Nenhuma saída registrada.</p>
            )}
          </div>
        </div>
      </section>

      {/* Limites */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic">Controle de Tetos</h3>
          <button onClick={() => setShowLimitModal(true)} className="text-[9px] font-bold text-[var(--green-whatsapp)] uppercase">+ Novo Limite</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.sortedLimits.map(lim => {
            const pct = lim.limit > 0 ? Math.min(100, (lim.spent / lim.limit) * 100) : 0;
            return (
              <div key={lim.id} className="bg-[var(--surface)] p-5 rounded-[2rem] border border-[var(--border)] shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-black text-[var(--text-primary)] uppercase">{lim.category}</h4>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${pct >= 100 ? 'bg-red-500 text-white' : pct >= 80 ? 'bg-amber-400/20 text-amber-500' : 'bg-[var(--green-whatsapp)]/20 text-[var(--green-whatsapp)]'}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-[var(--bg-body)] rounded-full overflow-hidden mb-2">
                  <div className={`h-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-[var(--green-whatsapp)]'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-[var(--text-muted)]">
                  <span>Gasto: {format(lim.spent)}</span>
                  <span>Meta: {format(lim.limit)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Histórico Recente */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic px-1">Histórico Recente (Fluxo de Caixa)</h3>
        <div className="bg-[var(--surface)] rounded-[2rem] border border-[var(--border)] overflow-hidden">
          {transactions
            .filter(t => t.paymentMethod !== 'CARD')
            .slice(0, 10)
            .map((t, i, filteredArray) => (
            <div key={t.id} className={`p-4 flex justify-between items-center ${i !== filteredArray.length - 1 ? 'border-b border-[var(--border)]/50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${t.type === 'INCOME' ? 'bg-[var(--green-whatsapp)]/20 text-[var(--green-whatsapp)]' : 'bg-rose-500/20 text-rose-500'}`}>
                  {t.type === 'INCOME' ? '↑' : '↓'}
                </div>
                <div>
                  <p className="text-xs font-black text-[var(--text-primary)] uppercase">{t.description}</p>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className={`text-xs font-black ${t.type === 'INCOME' ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
                  {t.type === 'INCOME' ? '+' : '-'}{format(t.amount)}
                </p>
                <button 
                  onClick={() => handleDeleteTransaction(t.id)}
                  className="p-2 text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="p-10 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase italic">
              Nenhuma transação encontrada.
            </div>
          )}
        </div>
      </section>

      {/* Modal Limite */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[var(--surface)] w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative border border-[var(--border)] animate-fade">
            <button onClick={() => setShowLimitModal(false)} className="absolute top-8 right-8 text-[var(--text-muted)] font-black text-xl">✕</button>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-6">Configurar Teto</h3>
            <div className="space-y-4">
              <input className="w-full bg-[var(--bg-body)] rounded-xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)]" placeholder="Categoria (Ex: Lanche)" value={limitCat} onChange={e => setLimitCat(e.target.value)} />
              <input type="number" className="w-full bg-[var(--bg-body)] rounded-xl p-4 text-sm font-bold text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--green-whatsapp)]" placeholder="Limite R$" value={limitVal} onChange={e => setLimitVal(e.target.value)} />
              <button onClick={handleCreateLimit} className="w-full bg-[var(--green-whatsapp)] text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-lg mt-4">Ativar Teto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;