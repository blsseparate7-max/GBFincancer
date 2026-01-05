
import React, { useMemo, useEffect, useState } from 'react';
import { Transaction, CategoryLimit } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getFinancialAdvice } from '../services/geminiService';

interface DashboardProps {
  transactions: Transaction[];
  budget: number;
  categoryLimits: CategoryLimit[];
  onUpdateBudget: (val: number) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard: React.FC<DashboardProps> = ({ transactions, budget, categoryLimits, onUpdateBudget }) => {
  const [advice, setAdvice] = useState<string>("Analisando suas finanças...");

  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  const catProgress = useMemo(() => {
    return categoryLimits.map(limit => {
      const spent = transactions
        .filter(t => t.type === 'EXPENSE' && t.category.toLowerCase() === limit.category.toLowerCase())
        .reduce((acc, t) => acc + t.amount, 0);
      return { ...limit, spent, percent: Math.min((spent / limit.amount) * 100, 100) };
    });
  }, [transactions, categoryLimits]);

  useEffect(() => {
    const fetchAdvice = async () => {
      if (transactions.length > 0) setAdvice(await getFinancialAdvice(transactions));
    };
    fetchAdvice();
  }, [transactions]);

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full bg-[#f8fafc]">
      {/* Resumo Geral */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">Orçamento Mensal</h3>
        <p className="text-3xl font-black text-gray-800">R$ {summary.expenses.toLocaleString('pt-BR')}</p>
        <p className="text-xs text-gray-400 mb-4">Meta total: R$ {budget.toLocaleString('pt-BR')}</p>
        <div className="w-full h-2 bg-gray-100 rounded-full">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((summary.expenses / (budget || 1)) * 100, 100)}%` }} />
        </div>
      </div>

      {/* Metas por Categoria */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-4">Metas por Categoria</h3>
        <div className="space-y-4">
          {catProgress.map((cp, idx) => (
            <div key={idx}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-gray-600 uppercase">{cp.category}</span>
                <span className={cp.spent > cp.amount ? 'text-red-500 font-bold' : 'text-gray-400'}>
                  R$ {cp.spent.toFixed(0)} / R$ {cp.amount.toFixed(0)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${cp.spent > cp.amount ? 'bg-red-500' : 'bg-blue-500'}`} 
                  style={{ width: `${cp.percent}%` }} 
                />
              </div>
            </div>
          ))}
          {catProgress.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma meta específica definida via chat.</p>}
        </div>
      </div>

      {/* Conselho IA */}
      <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-lg">
        <p className="text-xs font-bold opacity-80 mb-1">VISÃO ESTRATÉGICA</p>
        <p className="text-sm italic leading-relaxed">"{advice}"</p>
      </div>
    </div>
  );
};

export default Dashboard;
