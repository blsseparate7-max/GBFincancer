
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';

interface ChatProps {
  messages: Message[];
  onSend: (text: string) => void;
}

const ChatInterface: React.FC<ChatProps> = ({ messages, onSend }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-[#e5ddd5]">
      {/* WhatsApp Background Pattern */}
      <div className="absolute inset-0 whatsapp-pattern z-0"></div>
      
      {/* Chat Header */}
      <div className="p-3 bg-[#f0f2f5] border-b border-gray-300 flex items-center justify-between z-20 shrink-0">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-lg font-bold text-white shadow-sm overflow-hidden">
               <span className="text-[#00a884]">GB</span>
            </div>
            <div>
               <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">Assistente Financeiro</h3>
               <p className="text-[12px] text-gray-500">online</p>
            </div>
         </div>
         <div className="flex gap-5 text-gray-500 pr-3">
            <button className="hover:text-gray-900 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button className="hover:text-gray-900 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
         </div>
      </div>
      
      {/* Message List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 z-10 no-scrollbar relative">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
             <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-sm border border-gray-200 text-center max-w-xs animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-[#00a884] rounded-2xl flex items-center justify-center text-white mx-auto mb-5 text-2xl font-bold">G</div>
                <h4 className="text-sm font-bold text-gray-800 mb-2">Como posso ajudar?</h4>
                <p className="text-[12px] text-gray-500 leading-relaxed mb-6">Registre despesas ou peça um resumo das suas finanças.</p>
                <div className="space-y-2">
                   {["Gastei 50 no almoço", "Meu saldo?", "Anote minha senha do Pix"].map(cmd => (
                     <button 
                      key={cmd}
                      onClick={() => onSend(cmd)}
                      className="w-full py-2.5 bg-gray-50 rounded-xl text-[12px] font-semibold text-[#00a884] hover:bg-emerald-50 transition-colors border border-gray-100"
                     >
                       {cmd}
                     </button>
                   ))}
                </div>
             </div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} page-transition`}>
            <div className={`max-w-[85%] md:max-w-[70%] px-3.5 py-2 text-[14px] relative shadow-sm ${msg.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
              <p className="whitespace-pre-wrap text-gray-800 leading-normal">{msg.text}</p>
              <div className="flex items-center justify-end gap-1.5 mt-1 opacity-60">
                <span className="text-[10px] text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.sender === 'user' && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#53bdeb" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#f0f2f5] z-20 shrink-0">
        <div className="max-w-5xl mx-auto flex gap-3 items-center">
          <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center px-4 py-2">
             <input 
              className="w-full bg-transparent text-[14px] font-medium text-gray-800 focus:outline-none placeholder:text-gray-300"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Digite uma mensagem"
             />
          </div>
          <button 
            onClick={handleSend}
            className={`w-12 h-12 bg-[#00a884] text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform ${!input.trim() ? 'opacity-90' : 'opacity-100'}`}
          >
            {input.trim() ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
