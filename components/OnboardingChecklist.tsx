import React from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface OnboardingProps {
  steps: {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    action: () => void;
  }[];
}

const OnboardingChecklist: React.FC<OnboardingProps> = ({ steps }) => {
  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  if (completedCount === steps.length) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111b21] p-8 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden mb-8"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#00a884]/10 rounded-full -mr-32 -mt-32 blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-end mb-6">
          <div>
            <p className="text-[10px] font-black text-[#00a884] uppercase tracking-[0.4em] mb-2">Primeiros Passos</p>
            <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Configuração da Conta</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-500 uppercase mb-1">{completedCount}/{steps.length} Concluído</p>
            <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#00a884] transition-all duration-1000" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={step.action}
              disabled={step.completed}
              className={`p-5 rounded-3xl border transition-all text-left group flex flex-col justify-between h-full ${
                step.completed 
                ? 'bg-white/5 border-white/5 opacity-50 cursor-default' 
                : 'bg-white/5 border-white/10 hover:border-[#00a884] hover:bg-white/[0.07]'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  {step.completed ? (
                    <CheckCircle2 size={20} className="text-[#00a884]" />
                  ) : (
                    <Circle size={20} className="text-gray-600 group-hover:text-[#00a884]" />
                  )}
                </div>
                <h4 className={`text-xs font-black uppercase italic mb-1 ${step.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                  {step.title}
                </h4>
                <p className="text-[10px] font-medium text-gray-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
              {!step.completed && (
                <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-[#00a884] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  Configurar <ArrowRight size={12} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default OnboardingChecklist;
