import React, { useState, useRef, useEffect } from 'react';
import { UserSession, Message } from '../types';
import { parseMessage } from '../services/geminiService';
import { dispatchEvent } from '../services/eventDispatcher';

interface ChatProps {
  user: UserSession;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const ChatInterface: React.FC<ChatProps> = ({ user, messages, setMessages }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (textOverride?: string) => {
    const messageText = (textOverride || input).trim();
    if (!messageText || isLoading) return;
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      text: messageText, 
      sender: 'user', 
      timestamp: new Date() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await parseMessage(messageText, user.name);
      
      if (result.event) {
        await dispatchEvent(user.uid, {
          ...result.event,
          source: 'chat',
          createdAt: new Date()
        });
      }

      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: result.reply || "Feito! Já atualizei seus dados.", 
        sender: 'ai', 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "Houve um erro na análise, mas anotei sua intenção.",
        sender: 'ai',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Navegador não suporta gravação de voz.");
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (e: any) => handleSend(e.results[0][0].transcript);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden">
      {/* Mensagens */}
      <div 
        ref={scrollRef} 
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain no-scrollbar relative z-10"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.length === 0 && (
          <div className="flex justify-center my-10">
            <div className="bg-[#1f2c33] px-4 py-2 rounded-xl text-[10px] text-[#8696a0] shadow-sm uppercase font-black border border-[#2a3942] text-center">
              🔒 Auditoria IA Ativa • Mensagens Protegidas
            </div>
          </div>
        )}
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade`}>
            <div className={`max-w-[85%] px-3 py-2 text-[15px] relative shadow-lg ${msg.sender === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
              <div className="leading-tight pr-10 whitespace-pre-wrap">{msg.text}</div>
              <div className="text-[9px] text-[#8696a0] text-right absolute bottom-1 right-2 font-medium opacity-70">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start animate-fade">
             <div className="bubble-ai px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#00a884] italic">
               Analisando...
             </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex-none p-2 bg-[#111b21] border-t border-[#2a3942] z-20 w-full pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button 
            onClick={startVoiceRecording}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-all shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-[#8696a0] hover:bg-[#202c33]'}`}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          </button>

          <div className="flex-1 bg-[#202c33] rounded-[22px] flex items-center px-4 py-1 border border-[#2a3942]">
            <input 
              className="w-full bg-transparent text-[16px] text-[#e9edef] focus:outline-none placeholder-[#8696a0] py-2.5"
              placeholder="Fale com o Mentor..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isLoading && handleSend()}
              enterKeyHint="send"
            />
          </div>
          
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 bg-[#00a884] text-white rounded-full flex items-center justify-center disabled:opacity-50 shadow-md active:scale-90 shrink-0"
          >
            <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;