import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  limit,
  Timestamp
} from 'firebase/firestore';
import { SupportThread, SupportMessage, UserSession } from '../types';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { Send, MessageSquare, Clock, CheckCircle2, AlertCircle, Bot, User, ArrowLeft } from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

interface SupportTabProps {
  user: UserSession | null;
  onBackToAuth?: () => void;
}

interface LocalMessage {
  id: string;
  senderRole: 'user' | 'ai' | 'admin';
  text: string;
  createdAt: Date;
}

const SupportTab: React.FC<SupportTabProps> = ({ user, onBackToAuth }) => {
  const [visitorId, setVisitorId] = useState<string>('');
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeThread, setActiveThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize Visitor ID
  useEffect(() => {
    let vid = localStorage.getItem('gb_visitor_id');
    if (!vid) {
      vid = 'visitor_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('gb_visitor_id', vid);
    }
    setVisitorId(vid);
  }, []);

  // Fetch existing threads
  useEffect(() => {
    if (!visitorId && !user?.uid) return;

    const q = user?.uid 
      ? query(collection(db, 'supportThreads'), where('userId', '==', user.uid))
      : query(collection(db, 'supportThreads'), where('visitorId', '==', visitorId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const threadList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportThread));
      
      threadList.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setThreads(threadList);
      
      if (activeThread) {
        const updated = threadList.find(t => t.id === activeThread.id);
        if (updated) setActiveThread(updated);
      }
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'supportThreads');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, visitorId, activeThread?.id]);

  // Fetch messages for active thread
  useEffect(() => {
    if (!activeThread) return;

    const q = query(
      collection(db, `supportThreads/${activeThread.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportMessage));
      setMessages(msgList);
      
      if (activeThread.unreadByUser) {
        updateDoc(doc(db, 'supportThreads', activeThread.id), {
          unreadByUser: false
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `supportThreads/${activeThread.id}`));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `supportThreads/${activeThread.id}/messages`);
    });

    return () => unsubscribe();
  }, [activeThread?.id]);

  // AI Response Logic
  useEffect(() => {
    if (!activeThread || activeThread.status !== 'ai_active' || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.senderRole !== 'user') return;

    const triggerAi = async () => {
      setSending(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const escalateTool: FunctionDeclaration = {
          name: "escalateToAdmin",
          description: "Escala a conversa para um atendente humano quando a IA não consegue resolver, o usuário pede um humano, ou há erro técnico/pagamento.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              reason: { type: Type.STRING, description: "O motivo do escalonamento." }
            },
            required: ["reason"]
          }
        };

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: messages.slice(-10).map(m => ({
            role: m.senderRole === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          })),
          config: {
            systemInstruction: "Você é o suporte oficial do GB Financer. Seu objetivo é ajudar o usuário e, de forma natural, converter visitantes em clientes. Siga estas diretrizes: 1. AJUDE PRIMEIRO, VENDA DEPOIS: Nunca force uma venda. Seja útil primeiro. 2. COMPORTAMENTO: Responda a dúvida, mostre o valor do sistema e sugira o uso do app. 3. TOM: Responda como um atendente humano profissional, direto e claro. Não diga que é uma IA. 4. QUANDO FALAR DE COMPRA: Apenas quando fizer sentido (interesse do usuário, dor financeira ou dúvidas de acesso). 5. FRASES NATURAIS: Use expressões como 'isso já resolve boa parte disso pra você', 'no sistema você consegue ver isso na prática', 'isso te dá uma visão muito clara do seu dinheiro', 'vale a pena testar pra ver funcionando'. 6. NÃO FAÇA: Não use linguagem agressiva, não pareça um robô e não repita pitches de venda. 7. ESCALONAMENTO: Se o usuário insistir em um problema, se você não souber resolver, se ele pedir um humano, ou se houver erro técnico/pagamento, use a função 'escalateToAdmin'.",
            tools: [{ functionDeclarations: [escalateTool] }]
          }
        });

        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.some(fc => fc.name === 'escalateToAdmin')) {
          const call = functionCalls.find(fc => fc.name === 'escalateToAdmin');
          await updateDoc(doc(db, 'supportThreads', activeThread.id), {
            status: 'waiting_admin',
            updatedAt: serverTimestamp()
          });
          await addDoc(collection(db, `supportThreads/${activeThread.id}/messages`), {
            senderId: 'ai',
            senderRole: 'ai',
            text: `[SISTEMA] Atendimento escalado para humano. Motivo: ${call?.args?.reason || 'Solicitado pelo sistema'}`,
            createdAt: serverTimestamp()
          });
        } else {
          const aiText = response.text || 'Desculpe, não consegui processar sua solicitação.';
          await addDoc(collection(db, `supportThreads/${activeThread.id}/messages`), {
            senderId: 'ai',
            senderRole: 'ai',
            text: aiText,
            createdAt: serverTimestamp()
          });
          await updateDoc(doc(db, 'supportThreads', activeThread.id), {
            lastMessage: aiText,
            lastSender: 'ai',
            unreadByUser: true,
            updatedAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("AI Error:", error);
      } finally {
        setSending(false);
      }
    };

    const timer = setTimeout(triggerAi, 1000);
    return () => clearTimeout(timer);
  }, [messages.length, activeThread?.id, activeThread?.status]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      let threadId = activeThread?.id;

      if (!threadId) {
        const newThread = {
          userId: user?.uid || null,
          visitorId: user ? null : visitorId,
          userName: user?.name || 'Visitante',
          userEmail: user?.email || 'visitante@anonimo.com',
          status: 'ai_active',
          lastMessage: text,
          lastSender: 'user',
          unreadByAdmin: true,
          unreadByUser: false,
          source: 'direct',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'supportThreads'), newThread);
        threadId = docRef.id;
        setActiveThread({ id: threadId, ...newThread } as SupportThread);
      }

      await addDoc(collection(db, `supportThreads/${threadId}/messages`), {
        senderId: user?.uid || visitorId,
        senderRole: 'user',
        text,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'supportThreads', threadId), {
        lastMessage: text,
        lastSender: 'user',
        unreadByAdmin: true,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'supportThreads');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="w-3 h-3 text-amber-500" />;
      case 'waiting': return <Clock className="w-3 h-3 text-blue-500" />;
      case 'replied': return <MessageSquare className="w-3 h-3 text-green-500" />;
      case 'closed': return <CheckCircle2 className="w-3 h-3 text-gray-400" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ai_active': return 'Atendimento IA';
      case 'waiting_admin': return 'Aguardando Humano';
      case 'admin_active': return 'Atendimento Humano';
      case 'closed': return 'Encerrada';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-body)]">
        <div className="w-8 h-8 border-4 border-[var(--green-whatsapp)]/20 border-t-[var(--green-whatsapp)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-body)] overflow-hidden">
      {/* Header */}
      <div className="h-16 bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-4 gap-3 shrink-0">
        {(!user || activeThread) && (
          <button 
            onClick={() => {
              if (activeThread) {
                setActiveThread(null);
              } else if (onBackToAuth) {
                onBackToAuth();
              }
            }}
            className="w-8 h-8 flex items-center justify-center bg-[var(--bg-body)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
            {activeThread ? (activeThread.status === 'ai_active' ? 'Atendimento Oficial' : 'Suporte Humano') : 'Central de Ajuda'}
          </h3>
          <div className="flex items-center gap-1.5">
            {activeThread ? (
              <>
                {getStatusIcon(activeThread.status)}
                <span className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest">
                  {getStatusLabel(activeThread.status)}
                </span>
              </>
            ) : (
              <span className="text-[9px] font-black uppercase text-[var(--green-whatsapp)] tracking-widest">Online</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-[var(--chat-bg)]"
      >
        <div className="absolute inset-0 whatsapp-pattern pointer-events-none opacity-5"></div>
        
        {!activeThread && messages.length === 0 && (
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 bg-[var(--green-whatsapp)]/10 rounded-3xl flex items-center justify-center mx-auto border border-[var(--green-whatsapp)]/20">
              <Bot className="w-8 h-8 text-[var(--green-whatsapp)]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-[var(--text-primary)] uppercase">Olá! Como posso ajudar?</h4>
              <p className="text-[10px] text-[var(--text-muted)] font-medium max-w-[200px] mx-auto leading-relaxed">
                Tire suas dúvidas sobre o app, funcionalidades ou planos.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm relative ${
              msg.senderRole === 'user' 
                ? 'bg-[var(--green-whatsapp)] text-white rounded-tr-none' 
                : (msg.senderRole === 'admin' 
                    ? 'bg-blue-600 text-white rounded-tl-none' 
                    : 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-tl-none')
            }`}>
              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <span className={`text-[8px] block mt-1 opacity-60 text-right font-bold`}>
                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
              </span>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-[var(--surface)] border border-[var(--border)] px-4 py-2 rounded-2xl rounded-tl-none flex gap-1">
              <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[var(--surface)] border-t border-[var(--border)] shrink-0">
        <form onSubmit={handleSendMessage} className="relative">
          <input 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={(activeThread?.status === 'closed') || sending}
            className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl py-4 pl-5 pr-14 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)] transition-all disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || (activeThread?.status === 'closed') || sending}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[var(--green-whatsapp)] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[var(--green-whatsapp)]/20 active:scale-90 transition-all disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        
        {/* History / Active Threads */}
        {!activeThread && threads.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest px-1">Conversas Anteriores</h4>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {threads.map(t => (
                <button 
                  key={t.id}
                  onClick={() => {
                    setActiveThread(t);
                  }}
                  className="shrink-0 bg-[var(--bg-body)] border border-[var(--border)] rounded-xl p-3 text-left w-40 hover:border-[var(--green-whatsapp)] transition-all"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">{getStatusLabel(t.status)}</span>
                    {t.unreadByUser && <div className="w-2 h-2 bg-[var(--green-whatsapp)] rounded-full" />}
                  </div>
                  <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">{t.lastMessage}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportTab;
