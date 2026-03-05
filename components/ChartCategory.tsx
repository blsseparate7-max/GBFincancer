
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Transaction } from '../types';

interface ChartCategoryProps {
  transactions: Transaction[];
}

const COLORS = ['#00a884', '#34b7f1', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fff1f2', '#a5b4fc', '#818cf8', '#6366f1'];

const ChartCategory: React.FC<ChartCategoryProps> = ({ transactions }) => {
  const data = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyExpenses = transactions.filter(t => {
      const d = new Date(t.date);
      return t.type === 'EXPENSE' && 
             t.paymentMethod !== 'CARD' && 
             d.getMonth() === currentMonth && 
             d.getFullYear() === currentYear;
    });

    const categoryMap: Record<string, number> = {};
    monthlyExpenses.forEach(t => {
      const cat = t.category || 'Outros';
      categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
    });

    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (data.length === 0) {
    return (
      <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm flex flex-col items-center justify-center min-h-[300px]">
        <p className="text-4xl mb-4">📊</p>
        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Sem gastos este mês</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-sm flex flex-col min-h-[350px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest italic">Gastos por Categoria</h3>
          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Mês Atual</p>
        </div>
        <div className="w-8 h-8 bg-[var(--green-whatsapp)]/10 rounded-xl flex items-center justify-center text-[var(--green-whatsapp)]">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
        </div>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#ffffff', 
                border: '1px solid #e9edef', 
                borderRadius: '16px', 
                fontSize: '10px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
              formatter={(value: number) => [format(value), 'Total']}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              formatter={(value) => <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tighter">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 space-y-2">
        {data.slice(0, 3).map((item, idx) => (
          <div key={item.name} className="flex justify-between items-center text-[9px] font-black uppercase">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
              <span className="text-[var(--text-muted)]">{item.name}</span>
            </div>
            <span className="text-[var(--text-primary)]">{format(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChartCategory;
