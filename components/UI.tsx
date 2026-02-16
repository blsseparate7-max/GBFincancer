
import React from 'react';

// --- BUTTONS ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', fullWidth, children, className, ...props }) => {
  const base = "px-6 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-50";
  const variants = {
    primary: "bg-[#10B981] hover:bg-[#059669] text-white shadow-lg shadow-[#10B981]/10",
    secondary: "bg-[#1F2937] hover:bg-[#374151] text-[#E5E7EB] border border-[#374151]",
    ghost: "bg-transparent hover:bg-white/5 text-[#9CA3AF]",
    danger: "bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/20"
  };
  return (
    <button className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`} {...props}>
      {children}
    </button>
  );
};

// --- CARD ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; noPadding?: boolean }> = ({ children, className, noPadding }) => (
  <div className={`bg-[#111827] border border-[#1F2937] rounded-3xl shadow-xl ${noPadding ? '' : 'p-6'} ${className}`}>
    {children}
  </div>
);

// --- BADGE ---
export const Badge: React.FC<{ children: React.ReactNode; variant?: 'success' | 'warning' | 'danger' | 'info' }> = ({ children, variant = 'info' }) => {
  const styles = {
    success: "bg-[#10B981]/10 text-[#10B981]",
    warning: "bg-[#F59E0B]/10 text-[#F59E0B]",
    danger: "bg-[#EF4444]/10 text-[#EF4444]",
    info: "bg-[#38BDF8]/10 text-[#38BDF8]"
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles[variant]}`}>
      {children}
    </span>
  );
};

// --- PROGRESS ---
export const ProgressBar: React.FC<{ progress: number; color?: string }> = ({ progress, color = '#10B981' }) => (
  <div className="h-2 w-full bg-[#1F2937] rounded-full overflow-hidden">
    <div 
      className="h-full rounded-full transition-all duration-1000" 
      style={{ width: `${Math.min(100, progress)}%`, backgroundColor: color }}
    />
  </div>
);

// --- SKELETON ---
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-[#1F2937] rounded-xl ${className}`}></div>
);

// --- EMPTY STATE ---
export const EmptyState: React.FC<{ title: string; desc: string; icon: string; onAction?: () => void }> = ({ title, desc, icon, onAction }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
    <div className="text-5xl mb-6 opacity-40">{icon}</div>
    <h3 className="text-[#E5E7EB] font-bold text-lg mb-2">{title}</h3>
    <p className="text-[#9CA3AF] text-sm mb-8 leading-relaxed">{desc}</p>
    {onAction && <Button onClick={onAction}>Começar Agora</Button>}
  </div>
);
