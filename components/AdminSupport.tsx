import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  where
} from 'firebase/firestore';
import { SupportThread, SupportMessage, UserSession, SupportStatus } from '../types';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { Send, MessageSquare, Clock, CheckCircle2, AlertCircle, Filter, User, Mail, Bot } from 'lucide-react';

interface AdminSupportProps {
  admin: UserSession;
}

const AdminSupport: React.FC<AdminSupportProps> = ({ admin }) => {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeThread, setActiveThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupportStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let q = query(
      collection(db, 'supportThreads')
    );

    if (statusFilter !== 'all') {
      q = query(
        collection(db, 'supportThreads'),
        where('status', '==', statusFilter)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const threadList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportThread));
      
      // Sort client-side to avoid "Index Required" error
      threadList.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setThreads(threadList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'supportThreads');
    });

    return () => unsubscribe();
  }, [statusFilter]);

  useEffect(() => {
    if (!activeThread) return;

    const q = query(
      collection(db, `supportThreads/${activeThread.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportMessage));
      setMessages(msgList);
      
      // Mark as read by admin if there are unread messages
      if (activeThread.unreadByAdmin) {
        updateDoc(doc(db, 'supportThreads', activeThread.id), {
          unreadByAdmin: false
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `supportThreads/${activeThread.id}`));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `supportThreads/${activeThread.id}/messages`);
    });

    return () => unsubscribe();
  }, [activeThread?.id, activeThread?.unreadByAdmin]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeThread || sending) return;

    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, `supportThreads/${activeThread.id}/messages`), {
        senderId: admin.uid,
        senderRole: 'admin',
        text,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'supportThreads', activeThread.id), {
        lastMessage: text,
        lastSender: 'admin',
        unreadByUser: true,
        status: 'admin_active',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `supportThreads/${activeThread.id}`);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (status: SupportStatus) => {
    if (!activeThread) return;
    try {
      await updateDoc(doc(db, 'supportThreads', activeThread.id), {
        status,
        updatedAt: serverTimestamp()
      });
      setActiveThread(prev => prev ? { ...prev, status } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supportThreads/${activeThread.id}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ai_active': return <Bot className="w-3 h-3 text-purple-500" />;
      case 'waiting_admin': return <AlertCircle className="w-3 h-3 text-amber-500" />;
      case 'admin_active': return <Clock className="w-3 h-3 text-blue-500" />;
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
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--green-whatsapp)]/20 border-t-[var(--green-whatsapp)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-body)] overflow-hidden">
      <div className="flex-1 flex min-h-0">
        {/* Threads List Sidebar */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-[var(--border)] flex flex-col bg-[var(--surface)] ${activeThread ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-[var(--border)] space-y-4">
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Painel de Suporte</h2>
            
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {(['all', 'ai_active', 'waiting_admin', 'admin_active', 'closed'] as const).map((s) => (
                <button 
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                    statusFilter === s 
                      ? 'bg-[var(--green-whatsapp)] text-white border-[var(--green-whatsapp)]' 
                      : 'bg-[var(--bg-body)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--green-whatsapp)]'
                  }`}
                >
                  {s === 'all' ? 'Todos' : getStatusLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {threads.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-xs font-bold text-[var(--text-muted)]">Nenhum chamado encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {threads.map(thread => (
                  <button 
                    key={thread.id}
                    onClick={() => setActiveThread(thread)}
                    className={`w-full p-4 flex flex-col text-left hover:bg-black/5 transition-all relative ${
                      activeThread?.id === thread.id ? 'bg-[var(--bg-body)] border-l-4 border-l-[var(--green-whatsapp)]' : ''
                    }`}
                  >
                    {thread.unreadByAdmin && (
                      <div className="absolute top-4 right-4 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_red]" />
                    )}
                    
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black text-[var(--text-primary)] uppercase truncate max-w-[150px]">{thread.userName}</span>
                      <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">
                        {thread.updatedAt?.toDate ? thread.updatedAt.toDate().toLocaleDateString() : 'Recente'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 mb-2">
                      {getStatusIcon(thread.status)}
                      <span className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">{getStatusLabel(thread.status)}</span>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)] truncate font-medium">
                      {thread.lastMessage}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col min-w-0 bg-[var(--bg-body)] ${!activeThread ? 'hidden md:flex' : 'flex'}`}>
          {activeThread ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Chat Header */}
              <div className="h-20 bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-4 gap-4 shrink-0">
                <button 
                  onClick={() => setActiveThread(null)}
                  className="md:hidden w-8 h-8 flex items-center justify-center bg-[var(--bg-body)] rounded-full text-[var(--text-muted)]"
                >
                  ←
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-[var(--text-primary)] uppercase truncate">{activeThread.userName}</h3>
                    <span className="text-[9px] font-black text-[var(--text-muted)] opacity-50 truncate">({activeThread.userEmail})</span>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(activeThread.status)}
                      <span className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest">{getStatusLabel(activeThread.status)}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <select 
                        value={activeThread.status}
                        onChange={(e) => handleUpdateStatus(e.target.value as SupportStatus)}
                        className="bg-[var(--bg-body)] border border-[var(--border)] rounded-lg px-2 py-0.5 text-[8px] font-black uppercase text-[var(--green-whatsapp)] outline-none"
                      >
                        <option value="ai_active">Atendimento IA</option>
                        <option value="waiting_admin">Aguardando Humano</option>
                        <option value="admin_active">Atendimento Humano</option>
                        <option value="closed">Encerrada</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar"
              >
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm relative ${
                      msg.senderRole === 'admin' 
                        ? 'bg-[var(--green-whatsapp)] text-white rounded-tr-none' 
                        : (msg.senderRole === 'ai' 
                            ? 'bg-purple-600 text-white rounded-tl-none' 
                            : 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-tl-none')
                    }`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <span className={`text-[8px] block mt-1 opacity-60 text-right font-bold`}>
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-4 bg-[var(--surface)] border-t border-[var(--border)] shrink-0">
                <form onSubmit={handleSendMessage} className="relative">
                  <input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escreva sua resposta..."
                    disabled={sending}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl py-4 pl-5 pr-14 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--green-whatsapp)] transition-all disabled:opacity-50"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[var(--green-whatsapp)] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[var(--green-whatsapp)]/20 active:scale-90 transition-all disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
              <div className="w-20 h-20 bg-[var(--green-whatsapp)]/10 rounded-[2.5rem] flex items-center justify-center border border-[var(--green-whatsapp)]/20">
                <MessageSquare className="w-10 h-10 text-[var(--green-whatsapp)]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Selecione uma conversa</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest max-w-[250px] mx-auto leading-relaxed">
                  Escolha um chamado na lista lateral para visualizar o histórico e responder ao usuário.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSupport;
