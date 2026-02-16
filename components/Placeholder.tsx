
import React from 'react';
import { Card } from './UI';

interface PlaceholderProps {
  title: string;
  description: string;
}

const Placeholder: React.FC<PlaceholderProps> = ({ title, description }) => (
  <div className="p-6 h-full flex flex-col items-center justify-center text-center space-y-4 animate-fade">
    <div className="w-20 h-20 bg-[#1F2937] rounded-3xl flex items-center justify-center text-4xl grayscale opacity-20">🚧</div>
    <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{title}</h2>
    <p className="text-sm text-[#9CA3AF] max-w-xs leading-relaxed">{description}</p>
    <Card className="mt-8 border-[#10B981]/10">
      <p className="text-[10px] font-black text-[#10B981] uppercase tracking-widest">Em Desenvolvimento</p>
    </Card>
  </div>
);

export default Placeholder;
