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
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const formatCompact = (v: number) => {
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    // Filter transactions for current month
    const monthTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // Daily Stats for Calendar
    const dailyStats: Record<number, { income: number; expense: number; transactions: Transaction[] }> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      dailyStats[i] = { income: 0, expense: 0, transactions: [] };
    }

    monthTransactions.forEach(t => {
      const dateObj = new Date(t.date);
      const d = dateObj.getDate();
      
      if (dailyStats[d]) {
        if (t.type === 'INCOME') dailyStats[d].income += Number(t.amount);
        if (t.type === 'EXPENSE') dailyStats[d].expense += Number(t.amount);
        dailyStats[d].transactions.push(t);
      }
    });

    // Highlights
    let maxIncome = 0;
    let maxIncomeDay = 0;
    let maxExpense = 0;
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
      <div className="p-4 md:p-6 space-y-8 animate-pulse">
        <div className="h-12 w-48 bg-[var(--surface)] rounded-full mb-8"></div>
        <div className="h-96 bg-[var(--surface)] rounded-[2.5rem]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade pb-32 relative z-10 max-w-7xl mx-auto min-h-full">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-1">Fluxo de Caixa</h2>
          <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Calendário</h1>
        </div>

        {/* View Toggle */}
        <div className="flex bg-[var(--surface)] p-1 rounded-2xl border border-[var(--border)] shadow-sm">
          <button 
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-[var(--green-whatsapp)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Calendário
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-[var(--green-whatsapp)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Lista do Mês
          </button>
        </div>
      </header>

      {viewMode === 'calendar' ? (
        <section className="bg-[var(--surface)] p-4 md:p-8 rounded-[2.5rem] border border-[var(--border)] shadow-sm space-y-6 md:space-y-8 overflow-hidden relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
                <CalendarIcon size={16} className="text-[var(--green-whatsapp)]" />
                Movimentação Diária
              </h3>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-1">
                {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(stats.currentYear, stats.currentMonth))}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--green-whatsapp)]" />
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Entrada</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase">Saída</span>
              </div>
            </div>
          </div>

          {/* Grid do Calendário */}
          <div className="grid grid-cols-7 gap-1 md:gap-3">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase py-2">
                {day}
              </div>
            ))}
            
            {Array.from({ length: stats.firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square md:aspect-video rounded-xl opacity-20" />
            ))}

            {Array.from({ length: stats.daysInMonth }).map((_, i) => {
              const day = i + 1;
              const data = stats.dailyStats[day];
              const hasMovement = data.income > 0 || data.expense > 0;
              const isToday = day === new Date().getDate();
              
              let bgColor = 'bg-[var(--bg-body)]';
              let borderColor = 'border-[var(--border)]';
              
              if (hasMovement) {
                if (data.income > data.expense * 1.2) {
                  bgColor = 'bg-[var(--green-whatsapp)]/5';
                  borderColor = 'border-[var(--green-whatsapp)]/20';
                } else if (data.expense > data.income * 1.2) {
                  bgColor = 'bg-rose-500/5';
                  borderColor = 'border-rose-500/20';
                }
              }

              return (
                <motion.button
                  key={day}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square md:aspect-video p-1 md:p-3 rounded-xl md:rounded-2xl border ${borderColor} ${bgColor} flex flex-col justify-between items-start transition-all relative overflow-hidden group shadow-sm`}
                >
                  <span className={`text-[10px] sm:text-xs md:text-sm font-black ${isToday ? 'bg-[var(--green-whatsapp)] text-white w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full shadow-lg' : 'text-[var(--text-primary)]'}`}>
                    {day}
                  </span>
                  
                  <div className="w-full mt-auto space-y-0.5 overflow-hidden">
                    {/* Indicadores Visuais Mobile / Valores Desktop */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full gap-0.5">
                      {data.income > 0 && (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1 h-1 md:hidden rounded-full bg-[var(--green-whatsapp)]" />
                          <span className="hidden md:inline text-[7px] font-black text-[var(--green-whatsapp)] uppercase opacity-50">E:</span>
                          <span className="text-[7px] md:text-[9px] font-black text-[var(--green-whatsapp)] truncate">
                            {formatCompact(data.income)}
                          </span>
                        </div>
                      )}
                      {data.expense > 0 && (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1 h-1 md:hidden rounded-full bg-rose-500" />
                          <span className="hidden md:inline text-[7px] font-black text-rose-500 uppercase opacity-50">S:</span>
                          <span className="text-[7px] md:text-[9px] font-black text-rose-500 truncate">
                            {formatCompact(data.expense)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {hasMovement && (
                    <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${data.income >= data.expense ? 'bg-[var(--green-whatsapp)]' : 'bg-rose-500'} opacity-30`} />
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {(Object.entries(stats.dailyStats) as [string, { income: number; expense: number; transactions: Transaction[] }][])
            .filter(([_, data]) => data.income > 0 || data.expense > 0)
            .sort((a, b) => parseInt(b[0]) - parseInt(a[0])) // Mais recentes primeiro
            .map(([dayStr, data]) => {
              const day = parseInt(dayStr);
              const balance = data.income - data.expense;
              return (
                <motion.button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-full bg-[var(--surface)] p-5 rounded-3xl border border-[var(--border)] flex items-center justify-between group hover:border-[var(--green-whatsapp)] transition-all shadow-sm active:scale-[0.98]"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-[var(--bg-body)] rounded-2xl flex flex-col items-center justify-center border border-[var(--border)] group-hover:border-[var(--green-whatsapp)]/30 transition-colors">
                      <span className="text-[10px] font-black text-[var(--text-muted)] uppercase leading-none mb-1">Dia</span>
                      <span className="text-xl font-black text-[var(--text-primary)] leading-none">{day}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Movimentação</p>
                      <div className="flex gap-3">
                        {data.income > 0 && (
                          <div className="flex items-center gap-1">
                            <ArrowUpRight size={12} className="text-[var(--green-whatsapp)]" />
                            <span className="text-xs font-black text-[var(--green-whatsapp)]">{format(data.income)}</span>
                          </div>
                        )}
                        {data.expense > 0 && (
                          <div className="flex items-center gap-1">
                            <ArrowDownLeft size={12} className="text-rose-500" />
                            <span className="text-xs font-black text-rose-500">{format(data.expense)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Saldo</p>
                    <p className={`text-sm font-black italic ${balance < 0 ? 'text-rose-500' : 'text-[var(--green-whatsapp)]'}`}>
                      {balance > 0 ? '+' : ''}{format(balance)}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          
          {(Object.values(stats.dailyStats) as { income: number; expense: number; transactions: Transaction[] }[]).every(d => d.income === 0 && d.expense === 0) && (
            <div className="bg-[var(--surface)] p-12 rounded-[2.5rem] border border-dashed border-[var(--border)] text-center space-y-4">
              <div className="w-16 h-16 bg-[var(--bg-body)] rounded-full flex items-center justify-center mx-auto">
                <CalendarIcon size={32} className="text-[var(--text-muted)] opacity-20" />
              </div>
              <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest italic">Nenhuma movimentação registrada este mês.</p>
            </div>
          )}
        </section>
      )}

        {/* Destaques do Mês */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] space-y-1 shadow-sm">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Maior Entrada</p>
            <p className="text-xs font-black text-[var(--green-whatsapp)] italic">Dia {stats.highlights.maxIncomeDay}</p>
            <p className="text-sm font-black text-[var(--text-primary)]">{format(stats.highlights.maxIncome)}</p>
          </div>
          <div className="p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] space-y-1 shadow-sm">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Maior Saída</p>
            <p className="text-xs font-black text-rose-500 italic">Dia {stats.highlights.maxExpenseDay}</p>
            <p className="text-sm font-black text-[var(--text-primary)]">{format(stats.highlights.maxExpense)}</p>
          </div>
          <div className="p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] space-y-1 shadow-sm">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Melhor Dia</p>
            <p className="text-xs font-black text-blue-500 italic">Dia {stats.highlights.bestDay}</p>
            <p className="text-[10px] font-bold text-[var(--text-primary)] uppercase">Saldo Positivo</p>
          </div>
          <div className="p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] space-y-1 shadow-sm">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Dia Pesado</p>
            <p className="text-xs font-black text-amber-500 italic">Dia {stats.highlights.worstDay}</p>
            <p className="text-[10px] font-bold text-[var(--text-primary)] uppercase">Saldo Negativo</p>
          </div>
        </div>

      {/* Modal Detalhes do Dia */}
      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDay(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--surface)] w-full max-w-lg rounded-[3rem] p-6 md:p-10 shadow-2xl relative border border-[var(--border)] max-h-[90vh] overflow-hidden flex flex-col"
            >
              <button 
                onClick={() => setSelectedDay(null)} 
                className="absolute top-6 right-6 w-12 h-12 bg-[var(--bg-body)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-90 border border-[var(--border)]"
              >
                ✕
              </button>

              <div className="mb-8">
                <p className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-[0.4em] mb-2">Detalhamento Diário</p>
                <h3 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">
                  Dia {selectedDay} de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(stats.currentYear, stats.currentMonth))}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="p-5 bg-[var(--green-whatsapp)]/5 rounded-3xl border border-[var(--green-whatsapp)]/10">
                    <p className="text-[9px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest mb-2">Entradas</p>
                    <p className="text-xl font-black text-[var(--green-whatsapp)] italic">{format(stats.dailyStats[selectedDay].income)}</p>
                  </div>
                  <div className="p-5 bg-rose-500/5 rounded-3xl border border-rose-500/10">
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-2">Saídas</p>
                    <p className="text-xl font-black text-rose-500 italic">{format(stats.dailyStats[selectedDay].expense)}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
                <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4">Transações Realizadas</h4>
                {stats.dailyStats[selectedDay].transactions.length > 0 ? (
                  stats.dailyStats[selectedDay].transactions.map(t => (
                    <div key={t.id} className="p-5 bg-[var(--bg-body)] rounded-3xl border border-[var(--border)] flex justify-between items-center group hover:border-[var(--green-whatsapp)]/30 transition-all shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${t.type === 'INCOME' ? 'bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)]' : 'bg-rose-500/10 text-rose-500'}`}>
                          {t.type === 'INCOME' ? <ArrowUpRight size={22} /> : <ArrowDownLeft size={22} />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">{t.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{t.category}</span>
                            <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
                            <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{t.paymentMethod === 'CARD' ? 'Cartão' : 'Dinheiro/Pix'}</span>
                          </div>
                        </div>
                      </div>
                      <p className={`text-base font-black italic ${t.type === 'INCOME' ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
                        {t.type === 'INCOME' ? '+' : '-'}{format(t.amount)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center space-y-4 bg-[var(--bg-body)] rounded-[2.5rem] border border-dashed border-[var(--border)]">
                    <div className="w-16 h-16 bg-[var(--surface)] rounded-full flex items-center justify-center mx-auto">
                      <Info className="text-[var(--text-muted)] opacity-20" size={32} />
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest italic">Nenhuma movimentação neste dia.</p>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-[var(--border)] flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Saldo Líquido</p>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Resultado do dia</p>
                </div>
                <p className={`text-2xl font-black italic tracking-tighter ${stats.dailyStats[selectedDay].income - stats.dailyStats[selectedDay].expense < 0 ? 'text-rose-500' : 'text-[var(--green-whatsapp)]'}`}>
                  {stats.dailyStats[selectedDay].income - stats.dailyStats[selectedDay].expense > 0 ? '+' : ''}
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
