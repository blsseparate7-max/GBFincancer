import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserSession, Message, Transaction, CategoryLimit, Bill, CreditCardInfo, Wallet, UserCategory, SavingGoal, Debt, CategoryPattern } from '../types';
import { parseMessage } from '../services/geminiService';
import { parseStatementFile } from '../services/statementService';
import { dispatchEvent } from '../services/eventDispatcher';
import { learnCategoryPattern } from '../services/categoryService';
import { fetchChatContext } from '../services/databaseService';
import { formatCurrency, calculateMonthlySummary } from '../services/summaryService';
import ChatComposer from './ChatComposer';

import { db } from '../services/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, updateDoc, getDoc } from 'firebase/firestore';

interface ChatProps {
  user: UserSession;
  messages: Message[];
  transactions: Transaction[];
  limits: CategoryLimit[];
  reminders: Bill[];
  cards: CreditCardInfo[];
  wallets: Wallet[];
  categories: UserCategory[];
  goals: SavingGoal[];
  debts: Debt[];
  categoryPatterns: CategoryPattern[];
  onToggleSidebar: () => void;
  onOpenProfile: () => void;
  setMessages?: (msgs: Message[]) => void;
}

const ChatInterface: React.FC<ChatProps> = ({ 
  user, messages, transactions, limits, reminders, 
  cards, wallets, categories, goals, debts, categoryPatterns, onToggleSidebar, onOpenProfile, setMessages 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [isSelectingCard, setIsSelectingCard] = useState(false);
  const [isChangingCategory, setIsChangingCategory] = useState(false);
  const [salaryCheckDone, setSalaryCheckDone] = useState(false);
  const [pendingSalaryReminder, setPendingSalaryReminder] = useState<Bill | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);
  const summarySentRef = useRef(false);

  // Helper para enviar mensagem para o Firestore (Sincronização Total)
  const sendMessageToFirestore = async (text: string, sender: 'user' | 'ai', dedupeKey?: string) => {
    if (!user.uid) return;
    
    console.log(`GB Chat: Enviando mensagem (${sender}): "${text.substring(0, 30)}..."`);
    
    if (dedupeKey) {
      const q = query(
        collection(db, "users", user.uid, "messages"),
        where("dedupeKey", "==", dedupeKey),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        console.log(`GB Chat: Mensagem ignorada (dedupeKey duplicado: ${dedupeKey})`);
        return; 
      }
    }

    try {
      await addDoc(collection(db, "users", user.uid, "messages"), {
        text,
        sender,
        timestamp: serverTimestamp(),
        dedupeKey: dedupeKey || null,
        source: 'chat',
        resolved: false
      });
      console.log(`GB Chat: Mensagem salva no Firestore com sucesso.`);
    } catch (err) {
      console.error("GB Chat: Erro ao salvar mensagem no Firestore:", err);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, pendingAction]);

  useEffect(() => {
    setIsSelectingCard(false);
  }, [pendingAction, pendingEvents.length]);

  const monthlySummary = useMemo(() => calculateMonthlySummary(transactions), [transactions]);

  // Enviar resumo automático foi removido a pedido do usuário (Premium Chat)
  // O resumo agora é gerado apenas sob demanda pela IA.
  useEffect(() => {
    summarySentRef.current = true;
  }, []);

  // Orquestração de Lembretes e Alertas (Premium)
  useEffect(() => {
    if (!user || !user.uid || !reminders.length) return;

    const checkReminders = async () => {
      const now = new Date();
      const cycleKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // 1. Salário Pendente
      const salaryReminder = reminders.find(r => 
        r.type === 'RECEIVE' && 
        (r.description.toLowerCase().includes('salário') || r.description.toLowerCase().includes('salario')) &&
        !r.isPaid &&
        !r.resolved
      );

      if (salaryReminder) {
        const dedupeKey = `salary-prompt-${salaryReminder.id}-${cycleKey}`;
        
        // Verificar se já perguntamos neste ciclo via Firestore
        const q = query(
          collection(db, "users", user.uid, "messages"),
          where("dedupeKey", "==", dedupeKey),
          limit(1)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
          await sendMessageToFirestore(
            `Olá ${user.displayName || 'amigo'}! Notei que seu salário de **${formatCurrency(salaryReminder.amount)}** ainda não foi registrado. Já caiu na conta? 💰`,
            'ai',
            dedupeKey
          );
          setPendingSalaryReminder(salaryReminder);
        }
      }

      // 2. Alerta de Risco (80% da renda)
      const totalIncome = reminders
        .filter(r => r.type === 'RECEIVE')
        .reduce((acc, r) => acc + r.amount, 0);
      
      const totalSpent = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((acc, t) => acc + t.amount, 0);

      if (totalIncome > 0 && totalSpent > totalIncome * 0.8) {
        const riskMsg = `⚠️ **Alerta de Risco:** Seus gastos atingiram 80% da sua renda mensal. Recomendo cautela extra.`;
        const dedupeKey = `risk-alert-${cycleKey}`;
        
        const q = query(
          collection(db, "users", user.uid, "messages"),
          where("dedupeKey", "==", dedupeKey),
          limit(1)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
          await sendMessageToFirestore(riskMsg, 'ai', dedupeKey);
        }
      }
    };

    const timer = setTimeout(checkReminders, 3000);
    return () => clearTimeout(timer);
  }, [user, reminders, transactions]);

  const handleSalaryConfirm = async (confirmed: boolean) => {
    if (!pendingSalaryReminder) return;

    const today = new Date();
    const cycleKey = `${today.getMonth() + 1}-${today.getFullYear()}`;

    if (confirmed) {
      setPendingAction({
        type: 'ADD_INCOME',
        payload: {
          amount: pendingSalaryReminder.amount,
          category: pendingSalaryReminder.category || 'Recebimento',
          description: pendingSalaryReminder.description,
          date: new Date().toISOString(),
          reminderId: pendingSalaryReminder.id,
          cycleKey,
          targetWalletName: (pendingSalaryReminder as any).targetWalletName
        }
      });
      
      await sendMessageToFirestore("Excelente! Em qual carteira esse dinheiro entrou?", 'ai');
    } else {
      await sendMessageToFirestore("Sem problemas! Me avise quando o dinheiro cair para eu atualizar seus saldos. 😉", 'ai');
    }
    
    setPendingSalaryReminder(null);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || isProcessingRef.current) return;
    
    console.log(`GB Chat: handleSend recebido: "${text}"`);
    isProcessingRef.current = true;
    await sendMessageToFirestore(text.trim(), 'user');
    setIsLoading(true);

    try {
      // 1. Buscar contexto ATUALIZADO do Firestore (Fonte da Verdade)
      console.log("GB Chat: Buscando contexto atualizado...");
      const freshContext = await fetchChatContext(user.uid);
      const finalContext = freshContext ? { ...freshContext, userPatterns: categoryPatterns } : { reminders, cards, wallets, categories, transactions, goals, limits, debts, userPatterns: categoryPatterns };

      // 2. Processar com Gemini
      console.log("GB Chat: Chamando Gemini API...");
      const result = await parseMessage(text.trim(), user.name || 'Usuário', finalContext);
      console.log("GB Chat: Gemini respondeu:", result);
      
      if (result.events && result.events.length > 0) {
        console.log(`GB Chat: Detectados ${result.events.length} eventos.`);
        if (result.events.length === 1) {
          setPendingAction(result.events[0]);
          setPendingEvents([]);
        } else {
          setPendingEvents(result.events);
          setPendingAction(null);
        }
      }

      // 3. Enviar resposta da IA para o Firestore
      await sendMessageToFirestore(result.reply || "Entendido. ✅", 'ai');

    } catch (e) {
      console.error("GB Chat: Erro no processamento:", e);
      await sendMessageToFirestore("Houve um pequeno erro na análise, mas anotei sua intenção. Pode repetir? 😅", 'ai');
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleSendFile = async (file: File) => {
    if (isLoading) return;
    
    setIsLoading(true);
    await sendMessageToFirestore(`📎 Enviou arquivo: ${file.name}`, 'user');

    try {
      const result = await parseStatementFile(file);
      
      if (result.transactions && result.transactions.length > 0) {
        const events = result.transactions.map((t: any) => {
          const isDuplicate = transactions.some(prev => {
            const sameAmount = Math.abs(prev.amount) === Math.abs(t.amount);
            const sameDate = prev.date === t.date;
            const prevDesc = (prev.description || "").toLowerCase();
            const tDesc = (t.description || "").toLowerCase();
            const similarDesc = prevDesc.includes(tDesc) || tDesc.includes(prevDesc);
            return sameAmount && (sameDate || similarDesc);
          });

          return {
            type: t.isCardCharge ? 'ADD_CARD_CHARGE' : (t.type === 'INCOME' ? 'ADD_INCOME' : 'ADD_EXPENSE'),
            payload: {
              amount: t.amount,
              description: t.description,
              category: t.category || 'Outros',
              date: t.date,
              paymentMethod: t.paymentMethod || (t.isCardCharge ? 'CARD' : 'PIX'),
              isCardCharge: t.isCardCharge,
              isDuplicate,
              selected: !isDuplicate
            }
          };
        });

        if (events.length === 1) {
          setPendingAction(events[0]);
          setPendingEvents([]);
        } else {
          setPendingEvents(events);
          setPendingAction(null);
        }
        const bankInfo = result.summary?.bankName ? ` do ${result.summary.bankName}` : '';
        await sendMessageToFirestore(`Li seu extrato${bankInfo}! Encontrei ${events.length} lançamentos. Confira a prévia abaixo.`, 'ai');
      } else {
        await sendMessageToFirestore("Não consegui encontrar transações nesse arquivo.", 'ai');
      }
    } catch (error) {
      await sendMessageToFirestore("Houve um erro ao processar seu arquivo.", 'ai');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAllEvents = async (id: string, isCard: boolean = false) => {
    const selectedEvents = pendingEvents.filter(ev => ev.payload.selected);
    if (selectedEvents.length === 0) return;

    setIsLoading(true);
    try {
      const newCategoryNames = Array.from(new Set(
        selectedEvents
          .filter(e => !categories.find(c => c.name.toLowerCase() === e.payload.category.toLowerCase()))
          .map(e => e.payload.category.trim())
          .filter(name => name.length > 0)
      ));

      for (const catName of newCategoryNames) {
        await dispatchEvent(user.uid, {
          type: 'CREATE_CATEGORY',
          payload: { name: catName, color: '#00A884', icon: '📁' },
          source: 'chat',
          createdAt: new Date()
        });
      }

      for (const event of selectedEvents) {
        const eventToDispatch = { ...event };
        eventToDispatch.payload.confirmedBy = user.uid;
        
        // Aprender padrão de categoria do extrato
        if (eventToDispatch.payload.description && eventToDispatch.payload.category) {
          await learnCategoryPattern(user.uid, eventToDispatch.payload.description, eventToDispatch.payload.category);
        }

        if (isCard) {
          if (eventToDispatch.type === 'ADD_EXPENSE') eventToDispatch.type = 'ADD_CARD_CHARGE';
          eventToDispatch.payload.paymentMethod = 'CARD';
          eventToDispatch.payload.cardId = id;
        } else {
          if (eventToDispatch.type === 'ADD_INCOME') {
            eventToDispatch.payload.targetWalletId = id;
          } else {
            eventToDispatch.payload.sourceWalletId = id;
          }
        }

        await dispatchEvent(user.uid, {
          ...eventToDispatch,
          source: 'chat',
          createdAt: new Date()
        });
      }

      const name = isCard ? cards.find(c => c.id === id)?.name || 'Cartão' : wallets.find(w => w.id === id)?.name || 'Carteira';
      await sendMessageToFirestore(`✅ Sucesso! Importei ${selectedEvents.length} lançamentos para sua conta (${name}).`, 'ai');
      setPendingEvents([]);
    } catch (e) {
      await sendMessageToFirestore("Ocorreu um erro ao salvar alguns lançamentos.", 'ai');
    } finally {
      setIsLoading(false);
    }
  };

  const removePendingEvent = (index: number) => {
    setPendingEvents(prev => prev.filter((_, i) => i !== index));
  };

  const updatePendingEvent = (index: number, updates: any) => {
    setPendingEvents(prev => prev.map((ev, i) => i === index ? { ...ev, payload: { ...ev.payload, ...updates } } : ev));
  };

  const confirmPendingAction = async (id: string, isCard: boolean = false) => {
    if (!pendingAction) return;

    setIsLoading(true);
    try {
      const eventToDispatch = { ...pendingAction };
      
      // Aprender padrão de categoria
      if (eventToDispatch.payload.description && eventToDispatch.payload.category) {
        await learnCategoryPattern(user.uid, eventToDispatch.payload.description, eventToDispatch.payload.category);
      }

      if (pendingAction.payload.reminderId) {
        await dispatchEvent(user.uid, {
          type: 'PAY_REMINDER',
          payload: {
            billId: pendingAction.payload.reminderId,
            paymentMethod: isCard ? 'CARD' : 'PIX',
            sourceWalletId: isCard ? null : id,
            cardId: isCard ? id : null,
            cycleKey: pendingAction.payload.cycleKey,
            confirmedBy: user.uid
          },
          source: 'chat',
          createdAt: new Date()
        });
      } else {
        if (isCard) {
          eventToDispatch.type = 'ADD_CARD_CHARGE';
          eventToDispatch.payload.paymentMethod = 'CARD';
          eventToDispatch.payload.cardId = id;
          eventToDispatch.payload.confirmedBy = user.uid;
        } else {
          if (eventToDispatch.type === 'ADD_INCOME') {
            eventToDispatch.payload.targetWalletId = id;
          } else {
            eventToDispatch.payload.sourceWalletId = id;
            // O dispatcher agora cuida da inferência se necessário, ou deixa null
          }
          eventToDispatch.payload.confirmedBy = user.uid;
        }

        await dispatchEvent(user.uid, {
          ...eventToDispatch,
          source: 'chat',
          createdAt: new Date()
        });
      }

      const name = isCard ? cards.find(c => c.id === id)?.name || 'Cartão' : wallets.find(w => w.id === id)?.name || 'Carteira';
      const typeLabel = pendingAction.type === 'ADD_INCOME' ? 'Recebimento registrado' : 'Gasto anotado com sucesso';
      const amountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingAction.payload.amount);
      const feedback = `${typeLabel}  \n\n${amountFormatted} — ${pendingAction.payload.description}\nCarteira: ${name}\nCategoria: ${pendingAction.payload.category}`;
      
      await sendMessageToFirestore(feedback, 'ai');
      setPendingAction(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full bg-transparent overflow-hidden relative min-h-0">
      {/* Header do Chat (Estilo WhatsApp) */}
      <div className="shrink-0 h-16 bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-4 gap-3 z-20 shadow-sm">
        <button 
          onClick={onToggleSidebar}
          className="w-10 h-10 flex items-center justify-center bg-[var(--green-whatsapp)] text-white rounded-full hover:bg-[var(--green-whatsapp-dark)] transition-all active:scale-90 shadow-lg shrink-0"
        >
          <span className="text-xl font-black italic">$</span>
        </button>

        <div className="flex flex-1 items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[var(--green-whatsapp)] flex items-center justify-center text-white shadow-md shrink-0">
            <span className="font-black text-xs">GB</span>
          </div>
          <div className="flex flex-col truncate">
            <span className="text-[var(--text-primary)] font-black text-sm leading-tight truncate">Assistente GB</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--green-whatsapp)] animate-pulse" />
              <span className="text-[var(--green-whatsapp)] text-[10px] font-bold uppercase tracking-widest">Online agora</span>
            </div>
          </div>
        </div>

        <button 
          onClick={onOpenProfile}
          className="w-10 h-10 bg-[var(--bg-body)] rounded-full border border-[var(--border)] flex items-center justify-center overflow-hidden shadow-md active:scale-95 transition-all shrink-0"
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--green-whatsapp)]/20">
              <span className="text-sm font-black text-[var(--green-whatsapp)]">{user.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </button>
      </div>

      {/* Mensagens */}
      <div 
        ref={scrollRef} 
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain relative z-10 no-scrollbar"
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
                {(() => {
                  if (!msg.timestamp) return '';
                  const d = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })()}
              </div>
            </div>
          </div>
        ))}

        {pendingSalaryReminder && (
          <div className="flex flex-col items-start gap-2 animate-fade-in-up">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-5 shadow-xl w-full max-w-[90%]">
               <div className="flex gap-2">
                 <button 
                   onClick={() => handleSalaryConfirm(true)}
                   className="flex-1 bg-[var(--green-whatsapp)] text-white py-3 rounded-2xl font-black text-[10px] uppercase transition-all active:scale-95"
                 >
                   Sim, recebi
                 </button>
                 <button 
                   onClick={() => handleSalaryConfirm(false)}
                   className="flex-1 bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)] py-3 rounded-2xl font-black text-[10px] uppercase transition-all active:scale-95"
                 >
                   Ainda não
                 </button>
               </div>
            </div>
          </div>
        )}

        {pendingEvents.length > 0 && (
          <div className="flex flex-col items-start gap-2 animate-fade-in-up">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-4 shadow-2xl w-full max-w-[98%]">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest">Prévia de Importação</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase">{pendingEvents.filter(e => e.payload.selected).length} de {pendingEvents.length} selecionados</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setPendingEvents(prev => prev.map(e => ({ ...e, payload: { ...e.payload, selected: true } })))}
                        className="text-[8px] font-black text-[var(--green-whatsapp)] hover:underline uppercase"
                      >
                        Todos
                      </button>
                      <span className="text-[8px] text-[var(--text-muted)]">•</span>
                      <button 
                        onClick={() => setPendingEvents(prev => prev.map(e => ({ ...e, payload: { ...e.payload, selected: false } })))}
                        className="text-[8px] font-black text-rose-500 hover:underline uppercase"
                      >
                        Nenhum
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={() => setPendingEvents([])} className="w-8 h-8 flex items-center justify-center bg-[var(--bg-body)] rounded-full text-[var(--text-muted)] hover:text-rose-500 transition-colors shadow-sm">✕</button>
              </div>

              <div className="max-h-[350px] overflow-y-auto space-y-2 mb-4 pr-1 no-scrollbar">
                {pendingEvents.map((ev, idx) => (
                  <div 
                    key={idx} 
                    className={`bg-[var(--bg-body)] p-3 rounded-2xl border transition-all ${ev.payload.selected ? (ev.payload.isDuplicate ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border)]') : 'opacity-50 border-transparent grayscale'} relative group`}
                  >
                    <div className="flex gap-3 items-start">
                      <button 
                        onClick={() => updatePendingEvent(idx, { selected: !ev.payload.selected })}
                        className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${ev.payload.selected ? 'bg-[var(--green-whatsapp)] border-[var(--green-whatsapp)] text-white' : 'border-[var(--border)] bg-transparent'}`}
                      >
                        {ev.payload.selected && <span className="text-[10px] font-black">✓</span>}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <input 
                            type="text"
                            value={ev.payload.date}
                            onChange={(e) => updatePendingEvent(idx, { date: e.target.value })}
                            className="bg-transparent text-[9px] font-bold text-[var(--text-muted)] uppercase w-20 outline-none focus:text-[var(--green-whatsapp)]"
                          />
                          <div className="flex flex-col items-end">
                            <input 
                              type="text"
                              value={ev.payload.amount}
                              onChange={(e) => updatePendingEvent(idx, { amount: parseFloat(e.target.value) || 0 })}
                              className={`bg-transparent text-sm font-black text-right w-24 outline-none focus:ring-1 ring-[var(--green-whatsapp)] rounded px-1 ${ev.type === 'ADD_INCOME' ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}
                            />
                          </div>
                        </div>

                        <input 
                          type="text"
                          value={ev.payload.description}
                          onChange={(e) => updatePendingEvent(idx, { description: e.target.value })}
                          className="w-full bg-transparent text-xs font-bold text-[var(--text-primary)] mb-1 outline-none focus:text-[var(--green-whatsapp)]"
                        />

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <select 
                              value={categories.find(c => c.name === ev.payload.category) ? ev.payload.category : 'NEW'}
                              onChange={(e) => {
                                if (e.target.value === 'NEW') {
                                  updatePendingEvent(idx, { category: '', isNewCategory: true });
                                } else {
                                  updatePendingEvent(idx, { category: e.target.value, isNewCategory: false });
                                }
                              }}
                              className="bg-[var(--surface)] px-2 py-0.5 rounded-lg text-[9px] font-black uppercase italic text-[var(--green-whatsapp)] outline-none border border-[var(--border)]"
                            >
                              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              <option value="NEW">+ Nova Categoria</option>
                            </select>
                            
                            {ev.payload.isCardCharge && (
                              <span className="text-[8px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full uppercase">Cartão</span>
                            )}
                            
                            {ev.payload.isDuplicate && (
                              <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase">Duplicado?</span>
                            )}
                          </div>

                          {(ev.payload.isNewCategory || !categories.find(c => c.name === ev.payload.category)) && (
                            <input 
                              type="text"
                              placeholder="Nome da nova categoria..."
                              value={ev.payload.category}
                              onChange={(e) => updatePendingEvent(idx, { category: e.target.value })}
                              className="bg-[var(--bg-body)] border border-[var(--green-whatsapp)]/30 rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--green-whatsapp)] outline-none placeholder:text-[var(--text-muted)]/50"
                              autoFocus
                            />
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={() => removePendingEvent(idx)}
                        className="text-[var(--text-muted)] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[var(--bg-body)] rounded-2xl p-4 border border-[var(--border)]">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mb-3 text-center">
                  {isSelectingCard ? 'Escolha o Cartão:' : `Confirmar ${pendingEvents.filter(e => e.payload.selected).length} itens em:`}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {isSelectingCard ? (
                    <>
                      {cards.map(card => (
                        <button 
                          key={card.id}
                          onClick={() => confirmAllEvents(card.id, true)}
                          className="bg-[var(--surface)] hover:bg-rose-500/5 hover:border-rose-500 border border-[var(--border)] rounded-xl py-2.5 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex items-center gap-2"
                        >
                          <span className="text-base">💳</span>
                          <span className="truncate flex-1 text-left">{card.name}</span>
                        </button>
                      ))}
                      <button 
                        onClick={() => setIsSelectingCard(false)}
                        className="col-span-2 bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)] rounded-xl py-2 text-[9px] font-black uppercase transition-all active:scale-95"
                      >
                        Voltar para Carteiras
                      </button>
                    </>
                  ) : (
                    <>
                      {wallets.map(w => (
                        <button 
                          key={w.id}
                          onClick={() => confirmAllEvents(w.id, false)}
                          className="bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--green-whatsapp)] hover:bg-[var(--green-whatsapp)]/5 rounded-xl py-2.5 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex items-center gap-2"
                        >
                          <span className="text-base">{w.icon || '💰'}</span>
                          <span className="truncate flex-1 text-left">{w.name}</span>
                        </button>
                      ))}
                      {cards.length > 0 && (
                        <button 
                          onClick={() => {
                            if (cards.length === 1) confirmAllEvents(cards[0].id, true);
                            else setIsSelectingCard(true);
                          }}
                          className="bg-[var(--surface)] hover:bg-rose-500/5 hover:border-rose-500 border border-[var(--border)] rounded-xl py-2.5 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex items-center gap-2"
                        >
                          <span className="text-base">💳</span>
                          <span className="flex-1 text-left">Cartão de Crédito</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {pendingAction && (
          <div className="flex flex-col items-start gap-2 animate-fade-in-up">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-5 shadow-xl w-full max-w-[90%]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest">Rascunho de Lançamento</span>
                <button onClick={() => setPendingAction(null)} className="text-[var(--text-muted)] hover:text-rose-500 transition-colors">✕</button>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase">Valor</span>
                  <span className={`text-lg font-black ${pendingAction.type === 'ADD_INCOME' ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
                    {pendingAction.type === 'ADD_INCOME' ? '+' : '-'}{formatCurrency(pendingAction.payload.amount)}
                  </span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase">Categoria</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[var(--text-primary)] uppercase italic">{pendingAction.payload.category}</span>
                      <button 
                        onClick={() => setIsChangingCategory(!isChangingCategory)}
                        className="text-[9px] text-[var(--green-whatsapp)] font-bold uppercase hover:underline"
                      >
                        {isChangingCategory ? 'Fechar' : 'Trocar'}
                      </button>
                    </div>
                  </div>
                  
                  {isChangingCategory && (
                    <div className="grid grid-cols-2 gap-1 mt-2 max-h-[120px] overflow-y-auto no-scrollbar p-1 bg-[var(--bg-body)] rounded-xl border border-[var(--border)]">
                      {categories.map(cat => (
                        <button 
                          key={cat.id}
                          onClick={() => {
                            setPendingAction({
                              ...pendingAction,
                              payload: { ...pendingAction.payload, category: cat.name }
                            });
                            setIsChangingCategory(false);
                          }}
                          className="text-[9px] font-bold py-1.5 px-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--green-whatsapp)] text-left truncate"
                        >
                          {cat.name}
                        </button>
                      ))}
                      <button 
                        onClick={() => {
                          const newCat = prompt("Nome da nova categoria:");
                          if (newCat) {
                            setPendingAction({
                              ...pendingAction,
                              payload: { ...pendingAction.payload, category: newCat }
                            });
                            setIsChangingCategory(false);
                          }
                        }}
                        className="text-[9px] font-bold py-1.5 px-2 rounded-lg bg-[var(--green-whatsapp)]/10 border border-[var(--green-whatsapp)]/30 text-[var(--green-whatsapp)] text-left truncate"
                      >
                        + Criar Nova
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase">Descrição</span>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{pendingAction.payload.description}</span>
                </div>
              </div>

              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mb-3 text-center">
                {isSelectingCard ? 'Escolha o Cartão:' : (pendingAction.type === 'ADD_INCOME' ? 'Onde entrou esse dinheiro?' : 'De onde saiu esse dinheiro?')}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {isSelectingCard ? (
                  <>
                    {cards.map(card => (
                      <button 
                        key={card.id}
                        onClick={() => confirmPendingAction(card.id, true)}
                        className="bg-[var(--bg-body)] hover:bg-rose-500 hover:text-white border border-[var(--border)] rounded-2xl py-3 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex flex-col items-center gap-1"
                      >
                        <span className="text-lg">💳</span>
                        <span className="truncate w-full text-center">{card.name}</span>
                      </button>
                    ))}
                    <button 
                      onClick={() => setIsSelectingCard(false)}
                      className="col-span-2 bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)] rounded-xl py-2 text-[9px] font-black uppercase transition-all active:scale-95"
                    >
                      Voltar para Carteiras
                    </button>
                  </>
                ) : (
                  <>
                    {wallets.map(w => {
                      const isSuggested = pendingAction.payload.targetWalletName && w.name.toLowerCase() === pendingAction.payload.targetWalletName.toLowerCase();
                      return (
                        <button 
                          key={w.id}
                          onClick={() => confirmPendingAction(w.id, false)}
                          className={`${isSuggested ? 'bg-[var(--green-whatsapp)] text-white border-white' : 'bg-[var(--bg-body)] text-[var(--text-primary)] border-[var(--border)]'} hover:bg-[var(--green-whatsapp)] hover:text-white border rounded-2xl py-3 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex flex-col items-center gap-1 relative overflow-hidden`}
                        >
                          {isSuggested && <div className="absolute top-0 right-0 bg-[var(--text-primary)] text-[var(--green-whatsapp)] text-[7px] px-1 font-black">Sugerido</div>}
                          <span className="text-lg">{w.icon || '💰'}</span>
                          <span className="truncate w-full text-center">{w.name}</span>
                        </button>
                      );
                    })}
                    {cards.length > 0 && pendingAction.type !== 'ADD_INCOME' && (
                      <button 
                        onClick={() => {
                          if (cards.length === 1) confirmPendingAction(cards[0].id, true);
                          else setIsSelectingCard(true);
                        }}
                        className="bg-[var(--bg-body)] hover:bg-rose-500 hover:text-white border border-[var(--border)] rounded-2xl py-3 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex flex-col items-center gap-1"
                      >
                        <span className="text-lg">💳</span>
                        <span>Cartão</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start animate-fade">
             <div className="bubble-ai px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#00a884] italic">
               Analisando...
             </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <ChatComposer 
        onSendText={(text) => handleSend(text)} 
        onSendFile={(file) => handleSendFile(file)}
        isLoading={isLoading || !!pendingAction || pendingEvents.length > 0}
      />
    </div>
  );
};

export default ChatInterface;