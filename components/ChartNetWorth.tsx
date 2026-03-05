
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Transaction, SavingGoal, Wallet } from '../types';

interface ChartNetWorthProps {
  transactions: Transaction[];
  goals: SavingGoal[];
  wallets: Wallet[];
}

const ChartNetWorth: React.FC<ChartNetWorthProps> = ({ transactions, goals, wallets }) => {
  const data = useMemo(() => {
    const months = [];
    const now = new Date();
    
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        date: d,
        monthName: d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }

    return months.map(m => {
      // 1. Cumulative Transactions up to the end of this month
      const endOfMonth = new Date(m.year, m.month + 1, 0, 23, 59, 59);
      
      const income = transactions
        .filter(t => t.type === 'INCOME' && new Date(t.date) <= endOfMonth)
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      
      const expense = transactions
        .filter(t => t.type === 'EXPENSE' && t.paymentMethod !== 'CARD' && new Date(t.date) <= endOfMonth)
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      
      const liquidBalance = income - expense;

      // 2. Cumulative Goal Contributions up to the end of this month
      let goalsBalance = 0;
      goals.forEach(goal => {
        if (goal.contributions) {
          goalsBalance += goal.contributions
            .filter(c => new Date(c.date) <= endOfMonth)
            .reduce((s, c) => s + (Number(c.amount) || 0), 0);
        }
      });

      // 3. Wallet Balances (Simplified: using current balance for current month, 
      // and assuming it was similar in previous months if we don't have full history)
      // For a better evolution, we'd need historical wallet snapshots.
      // But we can use the current total wallet balance for the latest month.
      const isCurrentMonth = m.month === now.getMonth() && m.year === now.getFullYear();
      const walletTotal = isCurrentMonth ? wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0) : 0;

      const netWorth = liquidBalance + goalsBalance + walletTotal;

      return {
        name: m.monthName,
        netWorth: netWorth,
      };
    });
  }, [transactions, goals, wallets]);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-sm flex flex-col min-h-[350px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest italic">Evolução do Patrimônio</h3>
          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Últimos 6 Meses</p>
        </div>
        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
        </div>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#667781', fontSize: 9, fontWeight: 'bold' }} 
            />
            <YAxis 
              hide 
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#ffffff', 
                border: '1px solid #e9edef', 
                borderRadius: '16px', 
                fontSize: '10px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
              formatter={(value: number) => [format(value), 'Patrimônio']}
            />
            <Area 
              type="monotone" 
              dataKey="netWorth" 
              stroke="#6366f1" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorNetWorth)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex justify-between items-end">
        <div>
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Patrimônio Atual</p>
          <h4 className="text-xl font-black text-[var(--text-primary)] italic tracking-tighter">
            {format(data[data.length - 1].netWorth)}
          </h4>
        </div>
        <div className="flex items-center gap-1 text-[var(--green-whatsapp)] font-black text-[10px]">
          <span className="text-xs">▲</span>
          {(((data[data.length - 1].netWorth - data[0].netWorth) / (data[0].netWorth || 1)) * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
};

export default ChartNetWorth;
