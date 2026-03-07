import React, { useState, useRef, useEffect } from 'react';
import { UserSession, Message, Transaction, CategoryLimit, Bill, CreditCardInfo, Wallet, UserCategory } from '../types';
import { parseMessage } from '../services/geminiService';
import { dispatchEvent } from '../services/eventDispatcher';
import { calculateWeeklySummary, formatCurrency } from '../services/summaryService';

interface ChatProps {
  user: UserSession;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  transactions: Transaction[];
  limits: CategoryLimit[];
  reminders: Bill[];
  cards: CreditCardInfo[];
  wallets: Wallet[];
  categories: UserCategory[];
}

const ChatInterface: React.FC<ChatProps> = ({ user, messages, setMessages, transactions, limits, reminders, cards, wallets, categories }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const transcriptRef = useRef('');
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer para gravação
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Resumo Matinal
  useEffect(() => {
    const today = new Date().toLocaleDateString();
    const lastSummary = localStorage.getItem(`last_summary_${user.uid}`);
    
    if (lastSummary !== today && messages.length === 0) {
      const triggerSummary = async () => {
        setIsLoading(true);
        try {
          const result = await parseMessage("GERAR_RESUMO_MATINAL", user.name, { reminders, cards, wallets, categories });
          const aiMsg: Message = { 
            id: `summary-${Date.now()}`, 
            text: result.reply || "Bom dia! Vamos organizar suas finanças hoje?", 
            sender: 'ai', 
            timestamp: new Date() 
          };
          setMessages([aiMsg]);
          localStorage.setItem(`last_summary_${user.uid}`, today);
        } catch (e) {
          console.error("Erro no resumo matinal", e);
        } finally {
          setIsLoading(false);
        }
      };
      triggerSummary();
    }
  }, [user.uid, messages.length, reminders, cards, wallets]);

  // Resumo Semanal Automático
  useEffect(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Domingo
    const weekKey = `weekly_summary_${user.uid}_${startOfWeek.toLocaleDateString()}`;
    const hasSeenWeekly = localStorage.getItem(weekKey);

    if (!hasSeenWeekly && transactions.length > 0) {
      const showWeeklySummary = async () => {
        const summary = calculateWeeklySummary(transactions);
        const topCat = summary.topCategories[0];
        
        const summaryText = `📊 *RESUMO DA SEMANA*\n\n` +
          `💰 Entradas: *${formatCurrency(summary.income)}*\n` +
          `📉 Saídas: *${formatCurrency(summary.expense)}*\n` +
          `⚖️ Sobra: *${formatCurrency(summary.balance)}*\n\n` +
          (topCat ? `🔥 *Maior gasto:* ${topCat.category} (${formatCurrency(topCat.amount)})` : "");

        const aiMsg: Message = {
          id: `weekly-${Date.now()}`,
          text: summaryText,
          sender: 'ai',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMsg]);
        localStorage.setItem(weekKey, 'true');
      };
      
      const timer = setTimeout(showWeeklySummary, 3000);
      return () => clearTimeout(timer);
    }
  }, [user.uid, transactions, setMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (textOverride?: string) => {
    const messageText = (textOverride || input).trim();
    if (!messageText || isLoading || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
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
      const result = await parseMessage(messageText, user.name, { reminders, cards, wallets, categories });
      
      let proactiveReply = "";

      if (result.event) {
        await dispatchEvent(user.uid, {
          ...result.event,
          source: 'chat',
          createdAt: new Date()
        });

        // Proatividade: Checar limites
        if (result.event.type === 'ADD_EXPENSE' || result.event.type === 'ADD_CARD_CHARGE') {
          const cat = result.event.payload.category?.toUpperCase();
          const limit = limits.find(l => l.category.toUpperCase() === cat);
          if (limit) {
            const spent = limit.spent + result.event.payload.amount;
            const pct = (spent / limit.limit) * 100;
            if (pct >= 100) {
              proactiveReply = `\n\n⚠️ ATENÇÃO: Você estourou o limite de ${cat}! (Gasto: R$ ${spent.toFixed(2)} / Limite: R$ ${limit.limit.toFixed(2)})`;
            } else if (pct >= 80) {
              proactiveReply = `\n\n💡 ALERTA: Você já usou ${pct.toFixed(0)}% do seu limite de ${cat}. Falta pouco para atingir o teto!`;
            }
          }
        }
      }

      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: (result.reply || "Feito! Já atualizei seus dados.") + proactiveReply, 
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
      isProcessingRef.current = false;
    }
  };

  const toggleVoiceRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Navegador não suporta gravação de voz.");
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsRecording(true);
      setInterimTranscript('');
      transcriptRef.current = '';
    };

    recognition.onresult = (e: any) => {
      let currentInterim = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          currentInterim += e.results[i][0].transcript;
        }
      }
      const fullText = finalTranscript + currentInterim;
      setInterimTranscript(fullText);
      transcriptRef.current = fullText;
    };

    recognition.onerror = (e: any) => {
      console.error("Erro no microfone:", e.error);
      if (e.error === 'not-allowed') {
        alert("Permissão de microfone negada. Verifique as configurações do navegador.");
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      const textToSend = transcriptRef.current.trim();
      if (textToSend) {
        handleSend(textToSend);
      }
      setInterimTranscript('');
      transcriptRef.current = '';
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error("Falha ao iniciar reconhecimento:", err);
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden">
      {/* Mensagens */}
      <div 
        ref={scrollRef} 
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain relative z-10"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex justify-center my-10">
            <div className="bg-[var(--surface)] px-4 py-2 rounded-xl text-[10px] text-[var(--text-muted)] shadow-sm uppercase font-black border border-[var(--border)] text-center">
              🔒 Auditoria IA Ativa • Mensagens Protegidas
            </div>
          </div>
        )}
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade`}>
            <div className={`max-w-[85%] px-3 py-2 text-[15px] relative shadow-lg ${msg.sender === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
              <div className="leading-tight pr-10 whitespace-pre-wrap">{msg.text}</div>
              <div className="text-[9px] text-[var(--text-muted)] text-right absolute bottom-1 right-2 font-medium opacity-70">
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
      <div className="flex-none p-2 bg-[var(--surface)] border-t border-[var(--border)] z-20 w-full pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          {/* Botão de Microfone */}
          <button 
            onClick={toggleVoiceRecording}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-all shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-[var(--text-muted)] hover:bg-[var(--bg-body)]'}`}
          >
            {isRecording ? (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            )}
          </button>

          {/* Área de Input / Gravação */}
          <div className="flex-1 bg-[var(--bg-body)] rounded-[22px] flex items-center px-4 py-1 border border-[var(--border)] relative overflow-hidden min-h-[44px]">
            {isRecording ? (
              <div className="flex items-center justify-between w-full animate-fade">
                <div className="flex items-center gap-3 min-w-[60px]">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="text-[var(--text-primary)] font-mono text-sm">{formatTime(recordingTime)}</span>
                </div>
                
                <div className="flex-1 px-2 overflow-hidden">
                  <p className="text-[11px] text-[var(--text-primary)] truncate italic opacity-80">
                    {interimTranscript || "Ouvindo..."}
                  </p>
                </div>

                <button 
                  onClick={() => {
                    if (recognitionRef.current) {
                      recognitionRef.current.onend = null; // Evita enviar ao abortar
                      recognitionRef.current.abort();
                    }
                    setIsRecording(false);
                    setInterimTranscript('');
                  }}
                  className="text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline ml-2 shrink-0"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <input 
                className="w-full bg-transparent text-[16px] text-[var(--text-primary)] focus:outline-none placeholder-[var(--text-muted)] py-2.5"
                placeholder="Fale com o Mentor..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isLoading && handleSend()}
                enterKeyHint="send"
              />
            )}
          </div>
          
          {/* Botão de Enviar */}
          {!isRecording && (
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 bg-[#00a884] text-white rounded-full flex items-center justify-center disabled:opacity-50 shadow-md active:scale-90 shrink-0"
            >
              <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;