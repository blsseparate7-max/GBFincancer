
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
    if (!messageText) return;
    
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
      
      if (result.event && result.event.type) {
        await dispatchEvent(user.uid, {
          ...result.event,
          source: 'chat',
          createdAt: new Date()
        });
      }

      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: result.reply || "Mensagem processada com sucesso.", 
        sender: 'ai', 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error("Chat Error:", e);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "Desculpe, tive um problema ao processar. Pode tentar de novo?",
        sender: 'ai',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Microfone não suportado no seu navegador.");

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      if (transcript) handleSend(transcript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    
    recognition.start();
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-[#efeae2]">
      {/* Pattern Background */}
      <div className="absolute inset-0 whatsapp-pattern opacity-10 pointer-events-none z-0"></div>
      
      {/* Messages List */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar z-10 pb-4"
      >
        {messages.length === 0 && (
          <div className="flex justify-center my-10">
            <div className="bg-[#fff9c2] px-4 py-2 rounded-xl text-[11px] text-[#54656f] shadow-sm uppercase font-black border border-[#e1db9f] text-center max-w-[280px]">
              🔒 Suas conversas são privadas e protegidas por IA
            </div>
          </div>
        )}
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade`}>
            <div className={`
              max-w-[85%] lg:max-w-[70%] px-3 py-1.5 text-[14.5px] relative shadow-sm 
              ${msg.sender === 'user' ? 'bubble-user' : 'bubble-ai'}
            `}>
              <div className="leading-tight pr-10 whitespace-pre-wrap text-[#111b21]">{msg.text}</div>
              <div className="text-[10px] text-[#667781] text-right absolute bottom-1.5 right-2">
                {new Date(msg.timestamp?.seconds ? msg.timestamp.seconds * 1000 : msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start animate-fade">
            <div className="bubble-ai px-4 py-2 text-xs text-[#667781] italic flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-2 bg-[#f0f2f5] flex items-center gap-2 relative z-20 pb-[safe-area-inset-bottom]">
        <button 
          onClick={startVoiceRecording}
          className={`
            w-11 h-11 flex items-center justify-center rounded-full transition-all shrink-0
            ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-[#54656f] hover:bg-gray-200'}
          `}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>

        <div className="flex-1 bg-white rounded-2xl flex items-center px-4 py-2.5 shadow-sm border border-gray-200">
          <input 
            className="w-full bg-transparent text-[15px] text-[#111b21] focus:outline-none placeholder-[#667781] py-1"
            placeholder="Mensagem"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isLoading && handleSend()}
            autoFocus
          />
        </div>
        
        <button 
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="w-11 h-11 bg-[#00a884] text-white rounded-full flex items-center justify-center disabled:opacity-50 shadow-md active:scale-90 transition-transform shrink-0"
        >
          <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
            <path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
