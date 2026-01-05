
import React, { useState, useRef, useEffect } from 'react';
import { Message, Transaction, CategoryLimit } from '../types';
import { processUserIntent } from '../services/geminiService';

interface ChatInterfaceProps {
  onTransactionDetected: (t: Transaction) => void;
  onGoalDetected: (goal: { name: string; targetAmount: number; monthlySaving: number }) => void;
  transactions: Transaction[];
  budget: number;
  categoryLimits: CategoryLimit[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  onTransactionDetected, 
  onGoalDetected,
  transactions, 
  budget,
  categoryLimits 
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Olá! Sou seu GBFinancer - Assistente Financeiro. Você pode falar ou escrever o que deseja. \nEx: "Gastei 50 reais em pizza" ou "Quero criar uma meta de carro de 20 mil"',
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Web Speech API initialization
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => setIsRecording(false);
      recognitionRef.current.onend = () => setIsRecording(false);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setIsRecording(true);
      recognitionRef.current?.start();
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async (textToSend: string = input) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const result = await processUserIntent(textToSend);

    if (result.intent === 'CREATE_GOAL' && result.goalConfig) {
      onGoalDetected(result.goalConfig);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: `🎯 Entendido! Iniciei o planejamento da sua meta "${result.goalConfig?.name}". \n\n💰 Alvo: R$ ${result.goalConfig?.targetAmount.toFixed(2)}\n📥 Aporte: R$ ${result.goalConfig?.monthlySaving.toFixed(2)}/mês. \nConsulte a aba "Metas" para ver a estimativa de conclusão.`,
        sender: 'ai',
        timestamp: new Date(),
        isSystem: true
      }]);
    } 
    else if (result.intent === 'TRANSACTION' && result.transaction?.amount) {
      const transaction: Transaction = {
        ...result.transaction,
        id: Math.random().toString(36).substring(7),
        date: new Date().toISOString()
      } as Transaction;

      onTransactionDetected(transaction);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: transaction.type === 'SAVING' 
          ? `💰 Valor guardado com sucesso! Seus R$ ${transaction.amount.toFixed(2)} já foram somados ao progresso das suas metas.`
          : `✅ Lançamento anotado: R$ ${transaction.amount.toFixed(2)} em ${transaction.category}.`,
        sender: 'ai',
        timestamp: new Date(),
        transactionRef: transaction
      };
      setMessages(prev => [...prev, aiMsg]);
    } else {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: 'Não entendi perfeitamente. Pode repetir ou digitar? Tente algo como "Gastei 30 no mercado".',
        sender: 'ai',
        timestamp: new Date(),
      }]);
    }
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#e5ddd5] whatsapp-bg">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 shadow-md border-b-2 ${
              msg.sender === 'user' ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none border-[#c0e0a5]' : 'bg-white text-gray-800 rounded-tl-none border-gray-100'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>
              <div className="text-[9px] text-gray-400 text-right mt-1 font-bold">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isTyping && <div className="p-3 bg-white rounded-full w-16 text-center shadow-sm animate-pulse text-xs font-bold text-gray-400">...</div>}
      </div>

      <div className="bg-[#f0f2f5] p-3 flex items-center gap-2 border-t">
        <button 
          onClick={toggleRecording}
          className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'bg-gray-200 text-gray-600'}`}
        >
          {isRecording ? (
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          )}
        </button>

        <input 
          type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isRecording ? "Ouvindo..." : "Escreva ou use a voz..."}
          className="flex-1 bg-white rounded-full px-4 py-3 focus:outline-none text-sm border border-gray-200 shadow-inner"
        />

        <button onClick={() => handleSend()} className="bg-[#075e54] text-white p-3 rounded-full shadow-lg active:scale-90 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
