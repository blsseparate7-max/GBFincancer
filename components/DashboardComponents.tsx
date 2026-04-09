import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, TrendingDown, Wallet as WalletIcon, PiggyBank, 
  AlertCircle, Calendar, Lightbulb, ArrowRight, Target,
  ChevronLeft, ChevronRight, Info, DollarSign, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, Sparkles, Loader2, Plus, Trophy
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';

const format = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const DailyInsight: React.FC<{ insight: string }> = React.memo(({ insight }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="bg-gradient-to-r from-[#00a884] to-[#008069] p-6 rounded-[2.5rem] text-white shadow-xl flex items-center gap-6 relative overflow-hidden group"
  >
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
      <Sparkles size={80} />
    </div>
    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
      <Lightbulb size={24} />
    </div>
    <div className="flex-1">
      <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1 opacity-80">Dica do Mentor GB</p>
      <p className="text-sm font-black italic leading-tight tracking-tight">"{insight}"</p>
    </div>
  </motion.div>
));

export const MainStats: React.FC<{ stats: any }> = React.memo(({ stats }) => (
  <section className="bg-[var(--surface)] p-8 md:p-12 rounded-[3rem] border border-[var(--border)] shadow-2xl relative overflow-hidden group">
    <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--green-whatsapp)]/5 rounded-full -mr-48 -mt-48 transition-transform group-hover:scale-110 duration-1000" />
    <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--accent-gold)]/5 rounded-full -ml-32 -mb-32 transition-transform group-hover:scale-110 duration-1000" />
    
    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div className="lg:col-span-7 space-y-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/20 rounded-full flex items-center gap-2">
            <Trophy size={12} className="text-[var(--accent-gold)]" />
            <span className="text-[10px] font-black text-[var(--accent-gold)] uppercase tracking-widest">Nível {stats.userLevel.level}</span>
          </div>
          <div className="flex-1 h-1 bg-[var(--bg-body)] rounded-full overflow-hidden max-w-[100px]">
            <div className="h-full bg-[var(--accent-gold)]" style={{ width: `${stats.userLevel.progress}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-[var(--green-whatsapp)] animate-pulse" />
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Saldo Disponível em Conta</p>
        </div>
        <h3 className={`text-6xl md:text-7xl font-black italic tracking-tighter leading-none ${stats.saldoLivre < 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
          {format(stats.saldoLivre)}
        </h3>
        <div className="flex items-center gap-4 pt-4">
          <div className="px-3 py-1 bg-[var(--green-whatsapp)]/10 rounded-full border border-[var(--green-whatsapp)]/20">
            <p className="text-[9px] font-black text-[var(--green-whatsapp)] uppercase italic">Saudável</p>
          </div>
          <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase italic">Atualizado agora</p>
        </div>
      </div>
      
      <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-4 bg-[var(--bg-body)]/50 rounded-3xl border border-[var(--border)] backdrop-blur-sm space-y-1">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Entradas</p>
          <p className="text-lg font-black text-[var(--green-whatsapp)] italic leading-none">{format(stats.income)}</p>
        </div>
        <div className="p-4 bg-[var(--bg-body)]/50 rounded-3xl border border-[var(--border)] backdrop-blur-sm space-y-1">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Saídas</p>
          <p className="text-lg font-black text-rose-500 italic leading-none">{format(stats.expense)}</p>
        </div>
        <div className="p-4 bg-[var(--bg-body)]/50 rounded-3xl border border-[var(--border)] backdrop-blur-sm space-y-1">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Metas</p>
          <p className="text-lg font-black text-[var(--accent-gold)] italic leading-none">{format(stats.totalSaved)}</p>
        </div>
      </div>
    </div>
  </section>
));

export const CashFlowChart: React.FC<{ barData: any[] }> = React.memo(({ barData }) => (
  <div className="lg:col-span-8 bg-[var(--surface)] p-8 md:p-10 rounded-[3rem] border border-[var(--border)] shadow-sm relative overflow-hidden">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
      <div>
        <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Fluxo de Caixa</h3>
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase italic">Comparativo mensal de performance</p>
      </div>
      <div className="flex gap-6 text-[10px] font-black uppercase italic">
        <span className="flex items-center gap-2 text-[var(--green-whatsapp)]"><div className="w-3 h-3 rounded-lg bg-[var(--green-whatsapp)] shadow-sm shadow-[var(--green-whatsapp)]/20" /> Entradas</span>
        <span className="flex items-center gap-2 text-rose-500"><div className="w-3 h-3 rounded-lg bg-rose-500 shadow-sm shadow-rose-500/20" /> Saídas</span>
      </div>
    </div>
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green-whatsapp)" stopOpacity={1}/>
              <stop offset="100%" stopColor="var(--green-whatsapp)" stopOpacity={0.6}/>
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={1}/>
              <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.6}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
          <XAxis dataKey="name" hide />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '900', fill: 'var(--text-muted)' }} />
          <Tooltip 
            cursor={{ fill: 'var(--bg-body)', opacity: 0.1 }}
            contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '1.5rem', border: '1px solid var(--border)', fontSize: '12px', fontWeight: '900', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
          />
          <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={80} animationDuration={1500}>
            {barData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? 'url(#incomeGradient)' : 'url(#expenseGradient)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
));

export const ProjectionCard: React.FC<{ projectedBalance: number }> = React.memo(({ projectedBalance }) => (
  <div className="lg:col-span-4 bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm flex flex-col justify-center text-center space-y-6 relative overflow-hidden group">
    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-body)]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="w-16 h-16 bg-[var(--green-whatsapp)]/10 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner relative z-10">
      <Calendar className="text-[var(--green-whatsapp)]" size={32} />
    </div>
    <div className="relative z-10">
      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2">Projeção Inteligente</p>
      <h4 className={`text-4xl font-black italic tracking-tighter leading-none ${projectedBalance < 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
        {format(projectedBalance)}
      </h4>
    </div>
    <div className="relative z-10 p-4 bg-[var(--bg-body)]/50 rounded-2xl border border-[var(--border)]">
      <p className="text-[11px] font-bold text-[var(--text-primary)] leading-relaxed italic">
        {projectedBalance < 0 
          ? "Alerta crítico! Sua projeção indica déficit. Recomenda-se revisão imediata de gastos variáveis."
          : `Performance positiva. Mantendo o ritmo atual, sua reserva livre será de ${format(projectedBalance)}.`}
      </p>
    </div>
  </div>
));

export const ExpenseRanking: React.FC<{ 
  ranking: any[]; 
  onCategoryClick?: (cat: string) => void;
  onSeeAll?: () => void;
  limit?: number;
}> = React.memo(({ ranking, onCategoryClick, onSeeAll, limit = 5 }) => {
  const displayRanking = limit > 0 ? ranking.slice(0, limit) : ranking;
  const hasMore = ranking.length > limit && limit > 0;

  return (
    <div className="bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm space-y-8 flex flex-col">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Top Categorias</h3>
          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Onde seu dinheiro está indo</p>
        </div>
        {hasMore && onSeeAll && (
          <button 
            onClick={onSeeAll}
            className="text-[9px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest hover:underline transition-all"
          >
            Ver todos
          </button>
        )}
      </div>
      <div className="space-y-6 flex-1">
        {displayRanking.map((item, i) => (
          <div 
            key={item.name} 
            className="space-y-3 cursor-pointer group"
            onClick={() => onCategoryClick?.(item.name)}
          >
            <div className="flex justify-between items-end">
              <span className="text-[11px] font-black text-[var(--text-primary)] uppercase italic tracking-tight group-hover:text-[var(--green-whatsapp)] transition-colors">{i + 1}. {item.name}</span>
              <span className="text-[10px] font-black text-[var(--text-muted)] italic">{item.percentage.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full bg-[var(--bg-body)] rounded-full overflow-hidden shadow-inner group-hover:border-[var(--green-whatsapp)]/30 transition-all">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${item.percentage}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-[var(--green-whatsapp)] to-emerald-400" 
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[8px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity italic">Ver detalhes →</p>
              <p className="text-[10px] font-black text-[var(--text-primary)] text-right italic">{format(item.value)}</p>
            </div>
          </div>
        ))}
        {ranking.length === 0 && (
          <div className="py-10 text-center opacity-20">
            <Info size={32} className="mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase italic">Sem dados de gastos</p>
          </div>
        )}
      </div>
      {hasMore && onSeeAll && (
        <button 
          onClick={onSeeAll}
          className="w-full py-4 bg-[var(--bg-body)] rounded-2xl border border-[var(--border)] text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest hover:text-[var(--green-whatsapp)] hover:border-[var(--green-whatsapp)]/30 transition-all flex items-center justify-center gap-2"
        >
          Ver lista completa <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
});

export const GlobalSpendingLimitCard: React.FC<{ 
  limit: number | null | undefined; 
  spent: number; 
  onEdit: () => void;
  onDelete: () => void;
  onAdd: () => void;
}> = React.memo(({ limit, spent, onEdit, onDelete, onAdd }) => {
  const pct = limit && limit > 0 ? (spent / limit) * 100 : 0;
  const isOver = pct >= 100;
  const isWarning = pct >= 80;

  return (
    <div className="bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm space-y-8 relative overflow-hidden group">
      <div className="flex justify-between items-center relative z-10">
        <div>
          <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Teto de Gastos Global</h3>
          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Limite mensal de despesas</p>
        </div>
        {limit ? (
          <div className="flex gap-2">
            <button 
              onClick={onEdit}
              className="w-8 h-8 bg-[var(--bg-body)] text-[var(--text-muted)] rounded-xl flex items-center justify-center hover:text-[var(--text-primary)] transition-all border border-[var(--border)] shadow-sm"
            >
              <Info size={14} />
            </button>
            <button 
              onClick={onDelete}
              className="w-8 h-8 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 shadow-sm"
            >
              <TrendingDown size={14} />
            </button>
          </div>
        ) : (
          <button 
            onClick={onAdd} 
            className="px-4 py-2 bg-[var(--green-whatsapp)] text-white rounded-xl font-black text-[9px] uppercase shadow-lg shadow-[var(--green-whatsapp)]/20 hover:scale-105 transition-all active:scale-95"
          >
            Definir Teto
          </button>
        )}
      </div>

      {!limit ? (
        <div className="py-6 text-center space-y-4 relative z-10">
          <div className="w-16 h-16 bg-[var(--bg-body)] rounded-full flex items-center justify-center mx-auto opacity-20">
            <Target size={32} />
          </div>
          <p className="text-[11px] font-black uppercase italic text-[var(--text-muted)]">Teto de gastos não definido</p>
          <button 
            onClick={onAdd}
            className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest hover:underline"
          >
            Começar agora →
          </button>
        </div>
      ) : (
        <div className="space-y-6 relative z-10">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Utilizado</p>
              <p className={`text-3xl font-black italic tracking-tighter leading-none ${isOver ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
                {format(spent)}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Limite</p>
              <p className="text-xl font-black text-[var(--text-primary)] italic leading-none opacity-60">
                {format(limit)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="h-4 w-full bg-[var(--bg-body)] rounded-full overflow-hidden shadow-inner p-1">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pct)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className={`h-full rounded-full transition-all duration-1000 ${isOver ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : isWarning ? 'bg-amber-400' : 'bg-[var(--green-whatsapp)]'}`} 
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-black italic">
              <span className="text-[var(--text-muted)] uppercase">Status do mês</span>
              <span className={isOver ? 'text-rose-500 animate-pulse' : isWarning ? 'text-amber-500' : 'text-[var(--green-whatsapp)]'}>
                {pct.toFixed(1)}% {isOver ? '(Limite Excedido)' : ''}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const SpendingLimitsCard: React.FC<{ limits: any[], onAdd: () => void }> = React.memo(({ limits, onAdd }) => (
  <div className="bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm space-y-8">
    <div className="flex justify-between items-center">
      <div>
        <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Tetos de Gastos</h3>
        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Controle de limites ativos</p>
      </div>
      <button 
        onClick={onAdd} 
        className="w-10 h-10 bg-[var(--green-whatsapp)]/10 text-[var(--green-whatsapp)] rounded-xl flex items-center justify-center hover:scale-110 transition-all active:scale-90 border border-[var(--green-whatsapp)]/20 shadow-sm"
      >
        <DollarSign size={18} />
      </button>
    </div>
    <div className="space-y-8">
      {limits.slice(0, 4).map(lim => (
        <div key={lim.id} className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-black text-[var(--text-primary)] uppercase italic tracking-tight">{lim.category}</span>
            {lim.pct >= 80 && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                <AlertCircle size={10} className="text-amber-500 animate-pulse" />
                <span className="text-[8px] font-black text-amber-500 uppercase italic">Alerta</span>
              </div>
            )}
          </div>
          <div className="h-2.5 w-full bg-[var(--bg-body)] rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, lim.pct)}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className={`h-full transition-all duration-1000 ${lim.pct >= 100 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : lim.pct >= 80 ? 'bg-amber-400' : 'bg-[var(--green-whatsapp)]'}`} 
            />
          </div>
          <div className="flex justify-between text-[10px] font-black italic">
            <span className="text-[var(--text-muted)] uppercase">{format(lim.spent)} <span className="opacity-30">/</span> {format(lim.limit)}</span>
            <span className={lim.pct >= 100 ? 'text-rose-500' : 'text-[var(--text-primary)]'}>{lim.pct.toFixed(0)}%</span>
          </div>
        </div>
      ))}
      {limits.length === 0 && (
        <div className="py-10 text-center opacity-20">
          <Target size={32} className="mx-auto mb-2" />
          <p className="text-[10px] font-black uppercase italic">Nenhum teto definido</p>
        </div>
      )}
    </div>
  </div>
));

export const CompositionChart: React.FC<{ pieData: any[], colors: string[], totalExpense: number }> = React.memo(({ pieData, colors, totalExpense }) => (
  <div className="bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm space-y-6">
    <div>
      <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Composição</h3>
      <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Mix de despesas por volume</p>
    </div>
    <div className="h-56 w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={75}
            paddingAngle={8}
            dataKey="value"
            animationDuration={1500}
          >
            {pieData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '1.5rem', border: '1px solid var(--border)', fontSize: '10px', fontWeight: '900', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total</p>
          <p className="text-xs font-black text-[var(--text-primary)] italic">{format(totalExpense)}</p>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {pieData.map((item, i) => (
        <div key={item.name} className="flex items-center gap-3 p-2 bg-[var(--bg-body)]/40 rounded-xl border border-[var(--border)]">
          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: colors[i % colors.length] }} />
          <span className="text-[9px] font-black text-[var(--text-primary)] truncate uppercase italic">{item.name}</span>
        </div>
      ))}
    </div>
  </div>
));

export const UpcomingBillsCard: React.FC<{ bills: any[] }> = React.memo(({ bills }) => (
  <section className="bg-[var(--surface)] p-10 rounded-[3rem] border border-[var(--border)] shadow-sm space-y-8">
    <div className="flex justify-between items-center">
      <div>
        <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Agenda de Pagamentos</h3>
        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase italic">Compromissos financeiros imediatos</p>
      </div>
      <div className="px-3 py-1 bg-rose-500/10 rounded-full border border-rose-500/20">
        <p className="text-[8px] font-black text-rose-500 uppercase italic">Atenção</p>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {bills.length > 0 ? (
        bills.map(bill => (
          <div key={bill.id} className="p-6 bg-[var(--bg-body)]/50 rounded-3xl border border-[var(--border)] flex justify-between items-center group hover:border-[var(--text-primary)] transition-all shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-black text-[var(--text-primary)] uppercase italic tracking-tight">{bill.description}</p>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${bill.daysLeft <= 1 ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`} />
                <p className={`text-[9px] font-black uppercase italic ${bill.daysLeft <= 1 ? 'text-rose-500' : 'text-[var(--text-muted)]'}`}>
                  {bill.daysLeft === 0 ? 'Vence hoje' : bill.daysLeft === 1 ? 'Vence amanhã' : `Vence em ${bill.daysLeft} dias`}
                </p>
              </div>
            </div>
            <p className="text-base font-black text-[var(--text-primary)] italic">{format(bill.amount)}</p>
          </div>
        ))
      ) : (
        <div className="col-span-3 py-12 text-center bg-[var(--bg-body)]/30 rounded-[2.5rem] border border-dashed border-[var(--border)]">
          <p className="text-[10px] text-[var(--text-muted)] font-black uppercase italic tracking-widest">Nenhum compromisso pendente para os próximos dias.</p>
        </div>
      )}
    </div>
  </section>
));

export const SuggestionCard: React.FC<{ suggestion: any }> = React.memo(({ suggestion }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-[var(--green-whatsapp)]/5 p-10 rounded-[3rem] border border-[var(--green-whatsapp)]/20 shadow-xl shadow-[var(--green-whatsapp)]/5 flex flex-col sm:flex-row items-start gap-8 relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-4 opacity-5">
      <Lightbulb size={120} />
    </div>
    <div className="w-16 h-16 bg-[var(--green-whatsapp)] rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-2xl shadow-[var(--green-whatsapp)]/40 relative z-10">
      <Lightbulb className="text-white" size={32} />
    </div>
    <div className="space-y-4 relative z-10">
      <h3 className="text-xs font-black text-[var(--green-whatsapp)] uppercase tracking-[0.3em]">Insights de Inteligência</h3>
      {suggestion ? (
        <p className="text-base font-medium text-[var(--text-primary)] leading-relaxed italic">
          Sua categoria <span className="font-black text-[var(--green-whatsapp)] underline decoration-dotted underline-offset-4">{suggestion.category}</span> está consumindo <span className="font-black">{suggestion.percentage}%</span> do orçamento. 
          Uma otimização de apenas 10% aqui liberaria <span className="font-black text-[var(--green-whatsapp)] bg-[var(--green-whatsapp)]/10 px-2 py-0.5 rounded-lg">{format(suggestion.saving)}</span> extras por mês.
        </p>
      ) : (
        <p className="text-base font-medium text-[var(--text-primary)] leading-relaxed italic">
          Continue alimentando o sistema com suas transações. Em breve, gerarei estratégias personalizadas para otimizar sua saúde financeira.
        </p>
      )}
    </div>
  </motion.div>
));

export const GoalSuggestionCard: React.FC<{ goalSuggestion: number, onApply: () => void }> = React.memo(({ goalSuggestion, onApply }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-[var(--accent-gold)]/5 p-10 rounded-[3rem] border border-[var(--accent-gold)]/20 shadow-xl shadow-[var(--accent-gold)]/5 flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-4 opacity-5">
      <Target size={120} />
    </div>
    <div className="flex flex-col sm:flex-row items-start gap-8 relative z-10">
      <div className="w-16 h-16 bg-[var(--accent-gold)] rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-2xl shadow-[var(--accent-gold)]/40">
        <Target className="text-white" size={32} />
      </div>
      <div className="space-y-4">
        <h3 className="text-xs font-black text-[var(--accent-gold)] uppercase tracking-[0.3em]">Aceleração de Metas</h3>
        <p className="text-base font-medium text-[var(--text-primary)] leading-relaxed italic">
          Identificamos uma folga de <span className="font-black text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 px-2 py-0.5 rounded-lg">{format(goalSuggestion)}</span> no seu fluxo. 
          Deseja aplicar este valor agora para atingir seus objetivos mais rápido?
        </p>
      </div>
    </div>
    <button 
      onClick={onApply}
      className="bg-[var(--accent-gold)] text-white w-16 h-16 rounded-[1.5rem] flex items-center justify-center hover:scale-110 transition-all shadow-2xl shadow-[var(--accent-gold)]/30 active:scale-90 shrink-0"
    >
      <ArrowRight size={28} />
    </button>
  </motion.div>
));
