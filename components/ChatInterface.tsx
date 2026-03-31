import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserSession, Message, Transaction, CategoryLimit, Bill, CreditCardInfo, Wallet, UserCategory, SavingGoal } from '../types';
import { parseMessage } from '../services/geminiService';
import { parseStatementFile } from '../services/statementService';
import { dispatchEvent } from '../services/eventDispatcher';
import { fetchChatContext } from '../services/databaseService';
import { formatCurrency, calculateMonthlySummary } from '../services/summaryService';
import ChatComposer from './ChatComposer';

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
  goals: SavingGoal[];
  onToggleSidebar: () => void;
  onOpenProfile: () => void;
}

const ChatInterface: React.FC<ChatProps> = ({ 
  user, messages, setMessages, transactions, limits, reminders, 
  cards, wallets, categories, goals, onToggleSidebar, onOpenProfile 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [salaryCheckDone, setSalaryCheckDone] = useState(false);
  const [pendingSalaryReminder, setPendingSalaryReminder] = useState<Bill | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);
  const summarySentRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, pendingAction]);

  const monthlySummary = useMemo(() => calculateMonthlySummary(transactions), [transactions]);

  // Enviar resumo automático apenas uma vez ao entrar
  useEffect(() => {
    if (summarySentRef.current) return;
    
    // Verificar se já foi enviado nesta sessão (sessionStorage)
    const sessionKey = `summary_sent_${user.uid}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) {
      summarySentRef.current = true;
      return;
    }

    // Verificar se já existe um resumo nas mensagens para evitar duplicidade em remounts
    const hasSummary = messages.some(m => m.text.includes("💰 Resumo rápido"));
    if (hasSummary) {
      summarySentRef.current = true;
      sessionStorage.setItem(sessionKey, 'true');
      return;
    }

    const generateSummary = () => {
      if (reminders.length === 0 && transactions.length === 0) return;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Saldo atual disponível (soma das carteiras ativas)
      const balance = wallets
        .filter(w => w.isActive !== false)
        .reduce((sum, w) => sum + (Number(w.balance) || 0), 0);

      // Contas Pendentes (Mês Atual ou Atrasadas)
      const pendingBills = reminders.filter(b => {
        const d = new Date(b.dueDate);
        return !b.isPaid && 
          b.type === 'PAY' && 
          b.isActive !== false &&
          (d.getFullYear() < currentYear || (d.getFullYear() === currentYear && d.getMonth() <= currentMonth));
      });
      const pendingTotal = pendingBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

      // Próxima conta (Pendente mais próxima)
      const nextBill = [...pendingBills].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

      // Insight de economia (Baseado no Dashboard)
      let insight = "Continue registrando para eu te dar dicas!";
      
      // Contas pagas vs totais
      const totalBillsThisMonth = reminders.filter(b => {
        const d = new Date(b.dueDate);
        return b.isActive !== false && b.type === 'PAY' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const paidBillsThisMonth = totalBillsThisMonth.filter(b => b.isPaid);
      
      if (totalBillsThisMonth.length > 0) {
        const percent = Math.round((paidBillsThisMonth.length / totalBillsThisMonth.length) * 100);
        insight = `Você já pagou **${percent}%** das suas contas fixas este mês. Continue assim!`;
      } else if (monthlySummary.categories.length > 0) {
        const top = monthlySummary.categories[0];
        insight = `Sua maior despesa é **${top.category}** (${formatCurrency(top.amount)}).`;
      }

      const summaryText = `💰 **Resumo rápido:**\n` +
        `Saldo atual: **${formatCurrency(balance)}**\n` +
        `Pendências: **${formatCurrency(pendingTotal)}** (${pendingBills.length} contas)\n` +
        `${nextBill ? `Próxima conta: **${nextBill.description}** (vence em ${Math.ceil((new Date(nextBill.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} dias)` : 'Nenhuma conta pendente para este mês'}\n\n` +
        `💡 **Insight:** ${insight}`;

      const summaryMsg: Message = {
        id: 'auto-summary-' + Date.now(),
        text: summaryText,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, summaryMsg]);
      summarySentRef.current = true;
      sessionStorage.setItem(sessionKey, 'true');
    };

    // Pequeno delay para garantir que os dados carregaram
    const timer = setTimeout(generateSummary, 800);
    return () => clearTimeout(timer);
  }, [monthlySummary, reminders, wallets, setMessages, messages, user.uid]);

  // Verificar primeiro recebimento após cadastro
  useEffect(() => {
    if (salaryCheckDone || reminders.length === 0) return;

    // Se o usuário tem perfil de renda mas não tem transações, é o primeiro login
    const isFirstLogin = transactions.length === 0;
    
    const today = new Date();
    const todayDay = today.getDate();

    // Procurar por lembretes de recebimento
    const salaryReminder = reminders.find(r => 
      !r.isPaid && 
      r.type === 'RECEIVE' && 
      (isFirstLogin || r.dueDay === todayDay)
    );

    if (salaryReminder) {
      setPendingSalaryReminder(salaryReminder);
      
      const msg: Message = {
        id: 'salary-check-' + Date.now(),
        text: isFirstLogin 
          ? `👋 Bem-vindo! Notei que você informou uma renda de **${formatCurrency(salaryReminder.amount)}**.\n\nVocê já recebeu esse valor este mês?`
          : `👋 Olá! Notei que hoje é dia de receber: **${salaryReminder.description}** (${formatCurrency(salaryReminder.amount)}).\n\nVocê já recebeu esse valor?`,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, msg]);
    }

    setSalaryCheckDone(true);
  }, [reminders, transactions, salaryCheckDone]);

  // Alerta de Risco Financeiro Proativo
  useEffect(() => {
    if (transactions.length === 0 || wallets.length === 0) return;

    const checkRisk = () => {
      const balance = wallets
        .filter(w => w.isActive !== false)
        .reduce((sum, w) => sum + (Number(w.balance) || 0), 0);

      const income = reminders
        .filter(r => r.type === 'RECEIVE')
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      let riskMsg = "";
      
      if (balance < 100 && balance > 0) {
        riskMsg = "⚠️ **Alerta de Risco:** Seu saldo total está muito baixo (menos de R$ 100). Evite gastos não essenciais hoje.";
      } else if (income > 0 && monthlySummary.expense > income * 0.8) {
        riskMsg = "🚨 **Alerta de Risco:** Seus gastos já comprometeram mais de 80% da sua renda mensal. Recomendo cautela extra.";
      }

      if (riskMsg) {
        // Verificar se já enviamos esse alerta recentemente
        const hasRiskMsg = messages.some(m => m.text.includes(riskMsg.substring(0, 20)));
        if (!hasRiskMsg) {
          setMessages(prev => [...prev, {
            id: 'risk-alert-' + Date.now(),
            text: riskMsg,
            sender: 'ai',
            timestamp: new Date()
          }]);
        }
      }
    };

    const timer = setTimeout(checkRisk, 3000);
    return () => clearTimeout(timer);
  }, [transactions, wallets, reminders]);

  const handleSalaryConfirm = (confirmed: boolean) => {
    if (!pendingSalaryReminder) return;

    if (confirmed) {
      // Se confirmou, abrimos o seletor de carteira
      setPendingAction({
        type: 'ADD_INCOME',
        payload: {
          amount: pendingSalaryReminder.amount,
          category: pendingSalaryReminder.category || 'Recebimento',
          description: pendingSalaryReminder.description,
          date: new Date().toISOString(),
          reminderId: pendingSalaryReminder.id,
          targetWalletName: (pendingSalaryReminder as any).targetWalletName
        }
      });
      
      const msg: Message = {
        id: 'salary-yes-' + Date.now(),
        text: "Excelente! Em qual carteira esse dinheiro entrou?",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, msg]);
    } else {
      const msg: Message = {
        id: 'salary-no-' + Date.now(),
        text: "Sem problemas! Me avise quando o dinheiro cair para eu registrar e atualizar seus saldos. 😉",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, msg]);
    }
    
    setPendingSalaryReminder(null);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    const userMsg: Message = { 
      id: Date.now().toString(), 
      text: text.trim(), 
      sender: 'user', 
      timestamp: new Date() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 1. Buscar contexto atualizado diretamente do Firestore (Fonte da Verdade)
      const freshContext = await fetchChatContext(user.uid);
      
      // 2. Usar o contexto fresco ou os props como fallback
      const finalContext = freshContext || { reminders, cards, wallets, categories, transactions, goals, limits };

      const result = await parseMessage(text.trim(), user.name, finalContext);
      
      if (result.events && result.events.length > 0) {
        // Se houver múltiplos eventos, colocamos na fila de confirmação
        setPendingEvents(result.events);
        
        // Alerta de Risco ou Gasto Suspeito pode vir no reply da IA
        const aiMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          text: result.reply || `Encontrei ${result.events.length} lançamentos. Pode confirmar para mim?`, 
          sender: 'ai', 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        // Se não houver eventos, mas a IA deu um reply (pode ser um alerta de risco ou previsão)
        const aiMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          text: result.reply || "Entendi. Como posso ajudar mais?", 
          sender: 'ai', 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, aiMsg]);
      }
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

  const handleSendFile = async (file: File) => {
    if (isLoading) return;
    
    setIsLoading(true);
    const userMsg: Message = { 
      id: Date.now().toString(), 
      text: `📎 Enviou arquivo: ${file.name}`, 
      sender: 'user', 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result = await parseStatementFile(file);
      
      if (result.transactions && result.transactions.length > 0) {
        // Converter transações do extrato em eventos do chat
        const events = result.transactions.map((t: any) => {
          // Detecção de duplicidade mais rigorosa
          const isDuplicate = transactions.some(prev => {
            const sameAmount = Math.abs(prev.amount) === Math.abs(t.amount);
            const sameDate = prev.date === t.date;
            const similarDesc = prev.description.toLowerCase().includes(t.description.toLowerCase()) || 
                               t.description.toLowerCase().includes(prev.description.toLowerCase());
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
              selected: !isDuplicate // Desmarcar duplicados por padrão
            }
          };
        });

        setPendingEvents(events);

        const bankInfo = result.summary?.bankName ? ` do ${result.summary.bankName}` : '';
        const aiMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          text: `Li seu extrato${bankInfo}! Encontrei ${events.length} lançamentos. Confira a prévia abaixo e selecione o que deseja importar.`, 
          sender: 'ai', 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: "Não consegui encontrar transações nesse arquivo. Pode verificar se é um extrato válido?",
          sender: 'ai',
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "Houve um erro ao processar seu arquivo. Tente novamente ou envie uma foto mais nítida.",
        sender: 'ai',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAllEvents = async (walletId: string | 'CARD') => {
    const selectedEvents = pendingEvents.filter(ev => ev.payload.selected);
    if (selectedEvents.length === 0) return;

    setIsLoading(true);
    try {
      for (const event of selectedEvents) {
        const eventToDispatch = { ...event };
        
        // Se o usuário escolheu uma carteira específica, mas o lançamento foi detectado como cartão,
        // e o usuário NÃO escolheu explicitamente 'CARD' no seletor geral,
        // nós respeitamos a escolha do seletor geral (walletId).
        
        if (walletId === 'CARD') {
          if (eventToDispatch.type === 'ADD_EXPENSE') {
            eventToDispatch.type = 'ADD_CARD_CHARGE';
          }
          eventToDispatch.payload.paymentMethod = 'CARD';
          eventToDispatch.payload.cardId = eventToDispatch.payload.cardId || 'default';
        } else {
          // Se for um INCOME, sempre vai para a carteira
          if (eventToDispatch.type === 'ADD_INCOME') {
            eventToDispatch.payload.targetWalletId = walletId;
          } else {
            // Se for EXPENSE, vai para a carteira como PIX/Débito
            eventToDispatch.payload.sourceWalletId = walletId;
            eventToDispatch.payload.paymentMethod = eventToDispatch.payload.paymentMethod || 'PIX';
          }
        }

        await dispatchEvent(user.uid, {
          ...eventToDispatch,
          source: 'chat',
          createdAt: new Date()
        });
      }

      const walletName = walletId === 'CARD' ? 'Cartão de Crédito' : wallets.find(w => w.id === walletId)?.name || 'Carteira';
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: `✅ Sucesso! Importei ${selectedEvents.length} lançamentos para sua conta (${walletName}).`,
        sender: 'ai',
        timestamp: new Date()
      }]);

      setPendingEvents([]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "Ocorreu um erro ao salvar alguns lançamentos. Por favor, verifique seu extrato.",
        sender: 'ai',
        timestamp: new Date()
      }]);
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

  const confirmPendingAction = async (walletId: string | 'CARD') => {
    if (!pendingAction) return;

    setIsLoading(true);
    try {
      const eventToDispatch = { ...pendingAction };
      
      if (pendingAction.payload.reminderId) {
        // Se veio de um lembrete (ex: salário), usamos PAY_REMINDER
        await dispatchEvent(user.uid, {
          type: 'PAY_REMINDER',
          payload: {
            billId: pendingAction.payload.reminderId,
            paymentMethod: 'PIX',
            sourceWalletId: walletId
          },
          source: 'chat',
          createdAt: new Date()
        });
      } else {
        if (walletId === 'CARD') {
          eventToDispatch.type = 'ADD_CARD_CHARGE';
          eventToDispatch.payload.paymentMethod = 'CARD';
          // Se já tiver um cardId da IA, mantém, senão usa 'default'
          eventToDispatch.payload.cardId = eventToDispatch.payload.cardId || 'default';
        } else {
          if (eventToDispatch.type === 'ADD_INCOME') {
            eventToDispatch.payload.targetWalletId = walletId;
          } else {
            eventToDispatch.payload.sourceWalletId = walletId;
            eventToDispatch.payload.paymentMethod = 'PIX'; // Padroniza como PIX/Débito quando sai de carteira
          }
        }

        await dispatchEvent(user.uid, {
          ...eventToDispatch,
          source: 'chat',
          createdAt: new Date()
        });
      }

      // Proatividade: Checar limites
      let proactiveReply = "";
      const freshContext = await fetchChatContext(user.uid);
      const currentLimits = freshContext?.limits || limits || [];
      
      if (eventToDispatch.type === 'ADD_EXPENSE' || eventToDispatch.type === 'ADD_CARD_CHARGE') {
        const cat = eventToDispatch.payload.category?.toUpperCase();
        const limit = currentLimits.find((l: any) => l.category.toUpperCase() === cat);
        if (limit) {
          const spent = limit.spent + eventToDispatch.payload.amount;
          const pct = (spent / limit.limit) * 100;
          if (pct >= 100) {
            proactiveReply = `\n\n⚠️ ATENÇÃO: Você estourou o limite de ${cat}!`;
          } else if (pct >= 80) {
            proactiveReply = `\n\n💡 ALERTA: Você já usou ${pct.toFixed(0)}% do seu limite de ${cat}.`;
          }
        }
      }

      const walletName = walletId === 'CARD' ? 'Cartão de Crédito' : wallets.find(w => w.id === walletId)?.name || 'Carteira';
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: `✅ Confirmado! Registrado via ${walletName}.${proactiveReply}`,
        sender: 'ai',
        timestamp: new Date()
      }]);

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
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

                        <div className="flex items-center gap-2">
                          <select 
                            value={ev.payload.category}
                            onChange={(e) => updatePendingEvent(idx, { category: e.target.value })}
                            className="bg-[var(--surface)] px-2 py-0.5 rounded-lg text-[9px] font-black uppercase italic text-[var(--green-whatsapp)] outline-none border border-[var(--border)]"
                          >
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            {!categories.find(c => c.name === ev.payload.category) && <option value={ev.payload.category}>{ev.payload.category}</option>}
                          </select>
                          
                          {ev.payload.isCardCharge && (
                            <span className="text-[8px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full uppercase">Cartão</span>
                          )}
                          
                          {ev.payload.isDuplicate && (
                            <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase">Duplicado?</span>
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
                  Confirmar {pendingEvents.filter(e => e.payload.selected).length} itens em:
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {wallets.map(w => (
                    <button 
                      key={w.id}
                      onClick={() => confirmAllEvents(w.id)}
                      className="bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--green-whatsapp)] hover:bg-[var(--green-whatsapp)]/5 rounded-xl py-2.5 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex items-center gap-2"
                    >
                      <span className="text-base">{w.icon || '💰'}</span>
                      <span className="truncate flex-1 text-left">{w.name}</span>
                    </button>
                  ))}
                  <button 
                    onClick={() => confirmAllEvents('CARD')}
                    className="bg-[var(--surface)] hover:bg-rose-500/5 hover:border-rose-500 border border-[var(--border)] rounded-xl py-2.5 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex items-center gap-2"
                  >
                    <span className="text-base">💳</span>
                    <span className="flex-1 text-left">Cartão de Crédito</span>
                  </button>
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
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase">Categoria</span>
                  <span className="text-xs font-black text-[var(--text-primary)] uppercase italic">{pendingAction.payload.category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase">Descrição</span>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{pendingAction.payload.description}</span>
                </div>
              </div>

              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase mb-3 text-center">
                {pendingAction.type === 'ADD_INCOME' ? 'Onde entrou esse dinheiro?' : 'De onde saiu esse dinheiro?'}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {wallets.map(w => {
                  const isSuggested = pendingAction.payload.targetWalletName && w.name.toLowerCase() === pendingAction.payload.targetWalletName.toLowerCase();
                  return (
                    <button 
                      key={w.id}
                      onClick={() => confirmPendingAction(w.id)}
                      className={`${isSuggested ? 'bg-[var(--green-whatsapp)] text-white border-white' : 'bg-[var(--bg-body)] text-[var(--text-primary)] border-[var(--border)]'} hover:bg-[var(--green-whatsapp)] hover:text-white border rounded-2xl py-3 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex flex-col items-center gap-1 relative overflow-hidden`}
                    >
                      {isSuggested && <div className="absolute top-0 right-0 bg-[var(--text-primary)] text-[var(--green-whatsapp)] text-[7px] px-1 font-black">Sugerido</div>}
                      <span className="text-lg">{w.icon || '💰'}</span>
                      <span className="truncate w-full text-center">{w.name}</span>
                    </button>
                  );
                })}
                {pendingAction.type !== 'ADD_INCOME' && (
                  <button 
                    onClick={() => confirmPendingAction('CARD')}
                    className="bg-[var(--bg-body)] hover:bg-rose-500 hover:text-white border border-[var(--border)] rounded-2xl py-3 px-2 text-[10px] font-black uppercase transition-all active:scale-95 flex flex-col items-center gap-1"
                  >
                    <span className="text-lg">💳</span>
                    <span>Cartão</span>
                  </button>
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