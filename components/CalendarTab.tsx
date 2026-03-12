import React, { useMemo, useState } from 'react';
import { Transaction, Bill } from '../types';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, 
  ArrowUpRight, ArrowDownLeft,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CalendarTabProps {
  transactions: Transaction[];
  reminders: Bill[];
  loading?: boolean;
}

const CalendarTab: React.FC<CalendarTabProps> = ({ transactions, reminders, loading }) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    // Filter transactions for current month
    const monthTransactions = transactions.filter(t => {
      // Usar a data da transação. Se for ISO string, o JS converte para o timezone local do navegador.
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // Daily Stats for Calendar
    const dailyStats: Record<number, { income: number; expense: number; transactions: Transaction[] }> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      dailyStats[i] = { income: 0, expense: 0, transactions: [] };
    }

    monthTransactions.forEach(t => {
      // Usar getDate() que respeita o timezone local do navegador para o objeto Date criado
      const dateObj = new Date(t.date);
      const d = dateObj.getDate();
      
      if (dailyStats[d]) {
        if (t.type === 'INCOME') dailyStats[d].income += Number(t.amount);
        if (t.type === 'EXPENSE') dailyStats[d].expense += Number(t.amount);
        dailyStats[d].transactions.push(t);
      }
    });

    // Highlights
    let maxIncome = -1;
    let maxIncomeDay = 0;
    let maxExpense = -1;
    let maxExpenseDay = 0;
    let bestBalance = -Infinity;
    let bestDay = 0;
    let worstBalance = Infinity;
    let worstDay = 0;

    Object.entries(dailyStats).forEach(([dayStr, data]) => {
      const day = parseInt(dayStr);
      const balance = data.income - data.expense;

      if (data.income > maxIncome) {
        maxIncome = data.income;
        maxIncomeDay = day;
      }
      if (data.expense > maxExpense) {
        maxExpense = data.expense;
        maxExpenseDay = day;
      }
      if (balance > bestBalance && (data.income > 0 || data.expense > 0)) {
        bestBalance = balance;
        bestDay = day;
      }
      if (balance < worstBalance && (data.income > 0 || data.expense > 0)) {
        worstBalance = balance;
        worstDay = day;
      }
    });

    return { 
      dailyStats, daysInMonth, firstDayOfMonth, currentMonth, currentYear,
      highlights: { maxIncomeDay, maxExpenseDay, bestDay, worstDay, maxIncome, maxExpense }
    };
  }, [transactions]);

  if (loading) {
    return (
      <div className="p-6 space-y-8 animate-pulse">
        <div className="h-96 bg-[var(--surface)] rounded-[2.5rem]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-fade pb-32 relative z-10 max-w-7xl mx-auto min-h-full">
      <header>
        <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Fluxo de Caixa</h2>
        <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Calendário</h1>
      </header>

      <section className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm space-y-8 overflow-hidden relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
              <CalendarIcon size={16} className="text-[var(--green-whatsapp)]" />
              Movimentação Mensal
            </h3>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-1">
              {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(stats.currentYear, stats.currentMonth))}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[var(--green-whatsapp)]" />
              <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Entrada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Saída</span>
            </div>
          </div>
        </div>

        {/* Destaques do Mês */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] space-y-1">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Maior Entrada</p>
            <p className="text-xs font-black text-[var(--green-whatsapp)]">Dia {stats.highlights.maxIncomeDay}</p>
            <p className="text-[10px] font-bold text-[var(--text-primary)]">{format(stats.highlights.maxIncome)}</p>
          </div>
          <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] space-y-1">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Maior Saída</p>
            <p className="text-xs font-black text-rose-500">Dia {stats.highlights.maxExpenseDay}</p>
            <p className="text-[10px] font-bold text-[var(--text-primary)]">{format(stats.highlights.maxExpense)}</p>
          </div>
          <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] space-y-1">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Melhor Dia</p>
            <p className="text-xs font-black text-blue-500">Dia {stats.highlights.bestDay}</p>
            <p className="text-[10px] font-bold text-[var(--text-primary)]">Saldo Positivo</p>
          </div>
          <div className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] space-y-1">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase">Dia Pesado</p>
            <p className="text-xs font-black text-amber-500">Dia {stats.highlights.worstDay}</p>
            <p className="text-[10px] font-bold text-[var(--text-primary)]">Saldo Negativo</p>
          </div>
        </div>

        {/* Grid do Calendário */}
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="text-center text-[9px] font-black text-[var(--text-muted)] uppercase py-2">
              {day}
            </div>
          ))}
          
          {Array.from({ length: stats.firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square md:aspect-video rounded-xl" />
          ))}

          {Array.from({ length: stats.daysInMonth }).map((_, i) => {
            const day = i + 1;
            const data = stats.dailyStats[day];
            const hasMovement = data.income > 0 || data.expense > 0;
            const isToday = day === new Date().getDate();
            
            let bgColor = 'bg-[var(--bg-body)]';
            let borderColor = 'border-[var(--border)]';
            
            if (hasMovement) {
              if (data.income > data.expense * 1.5) {
                bgColor = 'bg-[var(--green-whatsapp)]/10';
                borderColor = 'border-[var(--green-whatsapp)]/30';
              } else if (data.expense > data.income * 1.5) {
                bgColor = 'bg-rose-500/10';
                borderColor = 'border-rose-500/30';
              } else {
                bgColor = 'bg-blue-500/10';
                borderColor = 'border-blue-500/30';
              }
            }

            return (
              <motion.button
                key={day}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedDay(day)}
                className={`aspect-square md:aspect-video p-1 md:p-2 rounded-xl border ${borderColor} ${bgColor} flex flex-col justify-between items-start transition-all relative overflow-hidden group`}
              >
                <div className="w-full flex justify-between items-start mb-0.5">
                  <span className={`text-[10px] font-black ${isToday ? 'bg-[var(--text-primary)] text-white w-5 h-5 flex items-center justify-center rounded-full' : 'text-[var(--text-primary)]'}`}>
                    {day}
                  </span>
                </div>
                
                <div className="w-full mt-auto space-y-0.5 overflow-hidden">
                  {data.income > 0 && (
                    <div className="flex items-center justify-between w-full gap-0.5">
                      <span className="text-[7px] font-black text-[var(--green-whatsapp)] uppercase opacity-70 shrink-0">E:</span>
                      <span className="text-[8px] font-black text-[var(--green-whatsapp)] truncate">
                        {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(data.income)}
                      </span>
                    </div>
                  )}
                  {data.expense > 0 && (
                    <div className="flex items-center justify-between w-full gap-0.5">
                      <span className="text-[7px] font-black text-rose-500 uppercase opacity-70 shrink-0">S:</span>
                      <span className="text-[8px] font-black text-rose-500 truncate">
                        {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(data.expense)}
                      </span>
                    </div>
                  )}
                </div>

                {hasMovement && (
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${data.income >= data.expense ? 'bg-[var(--green-whatsapp)]/30' : 'bg-rose-500/30'}`} />
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Modal Detalhes do Dia */}
      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDay(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[var(--surface)] w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative border border-[var(--border)] max-h-[80vh] overflow-hidden flex flex-col"
            >
              <button 
                onClick={() => setSelectedDay(null)} 
                className="absolute top-6 right-6 w-10 h-10 bg-[var(--bg-body)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                ✕
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">
                  Dia {selectedDay} de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(stats.currentYear, stats.currentMonth))}
                </h3>
                <div className="flex gap-4 mt-4">
                  <div className="flex-1 p-4 bg-[var(--green-whatsapp)]/10 rounded-2xl border border-[var(--green-whatsapp)]/20">
                    <p className="text-[8px] font-black text-[var(--green-whatsapp)] uppercase mb-1">Entradas</p>
                    <p className="text-lg font-black text-[var(--green-whatsapp)]">{format(stats.dailyStats[selectedDay].income)}</p>
                  </div>
                  <div className="flex-1 p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                    <p className="text-[8px] font-black text-rose-500 uppercase mb-1">Saídas</p>
                    <p className="text-lg font-black text-rose-500">{format(stats.dailyStats[selectedDay].expense)}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
                <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Transações do Dia</h4>
                {stats.dailyStats[selectedDay].transactions.length > 0 ? (
                  stats.dailyStats[selectedDay].transactions.map(t => (
                    <div key={t.id} className="p-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] flex justify-between items-center group hover:border-[var(--text-primary)] transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'INCOME' ? 'bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)]' : 'bg-rose-500/10 text-rose-500'}`}>
                          {t.type === 'INCOME' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-[var(--text-primary)] uppercase">{t.description}</p>
                          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">{t.category}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-black ${t.type === 'INCOME' ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
                        {t.type === 'INCOME' ? '+' : '-'}{format(t.amount)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <Info className="mx-auto text-[var(--text-muted)] opacity-20" size={48} />
                    <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase italic">Nenhuma movimentação neste dia.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-[var(--border)] flex justify-between items-center">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase">Saldo Líquido do Dia</p>
                <p className={`text-lg font-black italic ${stats.dailyStats[selectedDay].income - stats.dailyStats[selectedDay].expense < 0 ? 'text-rose-500' : 'text-[var(--green-whatsapp)]'}`}>
                  {format(stats.dailyStats[selectedDay].income - stats.dailyStats[selectedDay].expense)}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalendarTab;
