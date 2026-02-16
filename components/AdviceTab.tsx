
import React from 'react';
import { SystemMessage } from '../types';
import { Card, Badge } from './UI';

interface AdviceTabProps {
  systemMessages: SystemMessage[];
}

const AdviceTab: React.FC<AdviceTabProps> = ({ systemMessages }) => {
  return (
    <div className="p-6 space-y-6 pb-32">
      <header>
        <h2 className="text-[10px] font-black text-[#10B981] uppercase tracking-[0.4em] mb-1">Central de Alertas</h2>
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Mensagens</h1>
      </header>

      <div className="space-y-4">
        {systemMessages.length > 0 ? systemMessages.map((msg) => (
          <Card key={msg.id} className="group border-l-4 border-l-[#F59E0B]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#1F2937] rounded-xl flex items-center justify-center text-xl shrink-0">
                {msg.type === 'ALERTA' ? '⚠️' : '🎯'}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <Badge variant={msg.type === 'ALERTA' ? 'warning' : 'success'}>{msg.type}</Badge>
                  <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm font-medium text-[#E5E7EB] leading-relaxed">{msg.text}</p>
              </div>
            </div>
          </Card>
        )) : (
          <div className="text-center py-20 opacity-30">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-xs font-black uppercase tracking-widest">Sem mensagens automáticas ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdviceTab;
