import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserSession, Message, Transaction, CategoryLimit, Bill, CreditCardInfo, Wallet, UserCategory, SavingGoal, Debt, CategoryPattern } from '../types';
import { parseMessage } from '../services/geminiService';
import { parseFinancialMessage } from '../services/financialMessageParser';
import { parseStatementFile } from '../services/statementService';
import { dispatchEvent } from '../services/eventDispatcher';
import { learnCategoryPattern, getCategoryId } from '../services/categoryService';
import { sendMessageToFirestore } from '../services/chatService';
import { fetchChatContext } from '../services/databaseService';
import { formatCurrency, calculateMonthlySummary } from '../services/summaryService';
import ChatComposer from './ChatComposer';
import { X, Check, Trash2, CreditCard, Tag, Plus } from 'lucide-react';

import { db, auth } from '../services/firebaseConfig';
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
  onNavigateToExtrato?: (filters: any) => void;
  highlightInput?: boolean;
  isExpired?: boolean;
}

const ChatInterface: React.FC<ChatProps> = ({ 
  user, messages, transactions, limits, reminders, 
  cards, wallets, categories, goals, debts, categoryPatterns, onToggleSidebar, onOpenProfile, setMessages, onNavigateToExtrato, highlightInput,
  isExpired = false
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
  const onboardingPromptSentRef = useRef(false);

  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Deduplicar e ordenar categorias para o seletor
  const sortedCategories = useMemo(() => {
    const seen = new Set<string>();
    const unique = categories.filter(cat => {
      const normalized = cat.name.toLowerCase().trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    // Categorias padrão (para ordenação)
    const standardNames = [
      'Alimentação', 'Mercado', 'Transporte', 'Combustível', 'Moradia', 
      'Contas', 'Saúde', 'Farmácia', 'Lazer', 'Assinaturas', 
      'Educação', 'Compras', 'Investimentos', 'Outros'
    ];

    return unique.sort((a, b) => {
      const aIndex = standardNames.indexOf(a.name);
      const bIndex = standardNames.indexOf(b.name);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  // Helper para enviar mensagem para o Firestore (Sincronização Total)
  const sendMessage = async (text: string, sender: 'user' | 'ai', dedupeKey?: string) => {
    await sendMessageToFirestore(user.uid, text, sender, dedupeKey);
  };

  const handleCreateCategoryInline = async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    // Normalização básica para exibição (Primeira letra maiúscula)
    const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    const id = getCategoryId(normalizedName);
    
    // Verificar se já existe (evitar duplicados)
    const exists = categories.find(c => c.id === id || c.name.toLowerCase() === name.toLowerCase());
    
    if (!exists) {
      try {
        await dispatchEvent(user.uid, {
          type: 'CREATE_CATEGORY',
          payload: { 
            name: normalizedName, 
            icon: 'Tag', 
            color: '#128C7E', 
            type: pendingAction?.type === 'ADD_INCOME' ? 'INCOME' : 'EXPENSE' 
          },
          source: 'chat',
          createdAt: new Date()
        });
      } catch (e) {
        console.error("Erro ao criar categoria via chat:", e);
      }
    }

    // Atualizar rascunho para selecionar esta categoria imediatamente
    if (pendingAction) {
      setPendingAction({
        ...pendingAction,
        payload: { ...pendingAction.payload, category: normalizedName, isNewCategory: false }
      });
    }
    
    setIsCreatingNewCategory(false);
    setNewCategoryName('');
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
    // Bloqueia alertas gerais durante o onboarding para evitar atropelar o fluxo
    if (!user || !user.uid || !reminders.length || !user.onboardingStatus?.completed) return;

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
          collection(db, "users", user.uid, "chat_messages"),
          where("dedupeKey", "==", dedupeKey),
          limit(1)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
          await sendMessage(
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
          collection(db, "users", user.uid, "chat_messages"),
          where("dedupeKey", "==", dedupeKey),
          limit(1)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
          await sendMessage(riskMsg, 'ai', dedupeKey);
        }
      }
    };

    const timer = setTimeout(checkReminders, 3000);
    return () => clearTimeout(timer);
  }, [user, reminders, transactions]);

  // Onboarding Welcome Message
  useEffect(() => {
    // Só dispara se estiver EXATAMENTE no passo 3 e ainda não respondeu OU processou
    if (!user || !user.uid || !user.onboardingStatus || user.onboardingStatus.completed || user.onboardingStatus.step !== 3 || user.onboardingStatus.onboardingIncomeProcessed || onboardingPromptSentRef.current) return;
    
    const checkOnboardingChat = async () => {
      if (user.onboardingStatus?.step === 3 && !user.onboardingStatus?.chatContextResponded && !user.onboardingStatus?.onboardingIncomeProcessed) {
        const dedupeKey = `onboarding-welcome-${user.uid}`;
        
        // Tenta encontrar o lembrete REAL criado no passo 1
        const salaryReminder = reminders.find(r => 
          r.type === 'RECEIVE' && 
          (r.description.toLowerCase().includes('recebimento') || r.description.toLowerCase().includes('salário'))
        );

        if (salaryReminder) {
          setPendingSalaryReminder(salaryReminder);
        } else {
          // Fallback se o lembrete ainda não tiver sido carregado
          const income = user.incomeProfile?.sources?.[0];
          const amount = income?.amountExpected || 2000;
          const wallet = income?.targetWalletName || 'Carteira Principal';
          
          setPendingSalaryReminder({
            id: 'onboarding-income',
            description: income?.description || 'Salário',
            amount: amount,
            dueDay: 1,
            category: 'Recebimento',
            type: 'RECEIVE',
            recurring: true,
            targetWalletName: wallet
          } as any);
        }

        // Verificar se já perguntamos no Firestore para não duplicar a mensagem visual
        const q = query(
          collection(db, "users", user.uid, "chat_messages"),
          where("dedupeKey", "==", dedupeKey),
          limit(1)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
          onboardingPromptSentRef.current = true;
          const firstName = (user.name || 'Usuário').split(' ')[0];
          const income = user.incomeProfile?.sources?.[0];
          const amount = income?.amountExpected || 2000;
          const wallet = income?.targetWalletName || 'Carteira Principal';
          
          await sendMessage(
            `Olá ${firstName}! Vi que você recebe **${formatCurrency(amount)}** no **${wallet}**. Já caiu na conta este mês? 💰`,
            'ai',
            dedupeKey
          );
        }
      }
    };

    const timer = setTimeout(checkOnboardingChat, 1000);
    return () => clearTimeout(timer);
  }, [user.onboardingStatus?.step, user.uid, reminders.length]);

  // 2. Lembretes de Recebimento Atrasados (Pós-Onboarding ou Geral)
  useEffect(() => {
    if (!user || !user.uid || user.onboardingStatus?.step === 3) return; // Step 3 já tem seu próprio prompter

    const checkOverdueIncome = async () => {
      const now = new Date();
      const today = now.getDate();
      
      // Encontra recebimentos pendentes que já deveriam ter caído (dueDay <= hoje)
      const overdueIncome = reminders.find(r => 
        r.type === 'RECEIVE' && 
        !r.isPaid && 
        !r.resolved &&
        r.dueDay <= today &&
        (!r.lastPromptedAt || (now.getTime() - (r.lastPromptedAt as any).toDate().getTime() > 24 * 60 * 60 * 1000))
      );

      if (overdueIncome) {
        const dedupeKey = `overdue-income-${overdueIncome.id}-${new Date().toISOString().split('T')[0]}`;
        
        // Verificar se já perguntamos hoje
        const q = query(
          collection(db, "users", user.uid, "chat_messages"),
          where("dedupeKey", "==", dedupeKey),
          limit(1)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
          setPendingSalaryReminder(overdueIncome);
          await sendMessage(
            `Oi! Notei que o recebimento **${overdueIncome.description}** (${formatCurrency(overdueIncome.amount)}) estava previsto para o dia ${overdueIncome.dueDay}. Já recebeu esse valor? 💸`,
            'ai',
            dedupeKey
          );
          
          // Atualiza o lembrete para não perguntar de novo hoje
          const reminderRef = doc(db, "users", user.uid, "reminders", overdueIncome.id);
          await updateDoc(reminderRef, { lastPromptedAt: serverTimestamp() });
        }
      }
    };

    const timer = setTimeout(checkOverdueIncome, 5000); // Espera 5s após carregar
    return () => clearTimeout(timer);
  }, [user?.uid, reminders.length]);

  // 3. Sistema de Lembretes Inteligente (Proativo)
  useEffect(() => {
    if (!user || !user.uid || !reminders.length || !user.onboardingStatus?.completed) return;

    const runScheduler = async () => {
      const { checkAndSendReminderNotifications } = await import('../services/reminderScheduler');
      await checkAndSendReminderNotifications(user, reminders);
    };

    const timer = setTimeout(runScheduler, 8000); // Roda 8s após carregar para não travar o boot
    return () => clearTimeout(timer);
  }, [user, reminders]);

  const handleSalaryConfirm = async (confirmed: boolean) => {
    if (!pendingSalaryReminder) return;

    const today = new Date();
    const cycleKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    if (confirmed) {
      const { dispatchEvent } = await import('../services/eventDispatcher');
      const incomePayload = {
        amount: pendingSalaryReminder.amount,
        category: pendingSalaryReminder.category || 'Recebimento',
        description: pendingSalaryReminder.description,
        date: new Date().toISOString(),
        // Se for onboarding e não tiver ID real, passamos null
        reminderId: pendingSalaryReminder.id === 'onboarding-income' ? null : pendingSalaryReminder.id,
        cycleKey,
        targetWalletName: (pendingSalaryReminder as any).targetWalletName,
        source: 'onboarding'
      };

      const result = await dispatchEvent(user.uid, {
        type: 'ADD_INCOME',
        payload: incomePayload,
        source: 'onboarding',
        createdAt: new Date()
      });

      if (result.success) {
        await sendMessage(`Excelente! Registrei o recebimento de **${formatCurrency(pendingSalaryReminder.amount)}** na sua carteira **${(pendingSalaryReminder as any).targetWalletName || 'Principal'}**. Seu saldo e dashboard já foram atualizados! 🚀`, 'ai');
      } else {
        await sendMessage("Houve um probleminha ao registrar seu salário. Mas não se preocupe, você pode tentar novamente ou registrar manualmente no Dashboard.", 'ai');
      }
    } else {
      await sendMessage("Entendido. Vou manter esse recebimento como pendente e te pergunto novamente em breve! 👍", 'ai');
      
      // Se for um lembrete real, atualiza o lastPromptedAt para não perguntar de novo imediatamente
      if (pendingSalaryReminder.id !== 'onboarding-income') {
        const reminderRef = doc(db, "users", user.uid, "reminders", pendingSalaryReminder.id);
        await updateDoc(reminderRef, { lastPromptedAt: serverTimestamp() });
      }
    }
    
    // Update onboarding status if this was the onboarding step
    if (user.onboardingStatus?.step === 3 && !confirmed) {
       // Se não confirmou, apenas marcamos que respondeu para não perguntar de novo nesta sessão
       // Mas o processamento real (onboardingIncomeProcessed) só acontece no ADD_INCOME
       const { syncUserData } = await import('../services/databaseService');
       await syncUserData(user.uid, { 
         onboardingStatus: { 
           ...user.onboardingStatus, 
           chatContextResponded: true,
           salaryConfirmed: false
         } as any 
       });
    }
    
    // Limpa o estado para não ficar travado
    setPendingSalaryReminder(null);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || isProcessingRef.current) return;

    if (isExpired) {
      await sendMessage(text.trim(), 'user');
      setIsLoading(true);
      setTimeout(async () => {
        await sendMessage("Seu período de teste expirou. 😔 Assine o GBFinancer Premium para continuar enviando mensagens e organizando suas finanças!", 'ai');
        setIsLoading(false);
      }, 1000);
      return;
    }

    // INTERCEPTAÇÃO CRÍTICA: Verificar se há confirmação pendente de onboarding ou lembrete proativo
    const lowerText = text.toLowerCase();
    if (pendingSalaryReminder) {
      if (lowerText.includes('sim') || lowerText === 's' || lowerText.includes('claro') || lowerText.includes('já') || lowerText.includes('paguei') || lowerText.includes('recebi')) {
        await handleSalaryConfirm(true);
        return;
      }
      if (lowerText.includes('não') || lowerText === 'n' || lowerText.includes('ainda não')) {
        await handleSalaryConfirm(false);
        return;
      }
    }

    // Verificar se o usuário está respondendo a um lembrete proativo de conta a pagar
    const lastAiMessage = [...messages].reverse().find(m => m.sender === 'ai');
    const billIdFromPayload = lastAiMessage?.actionType === 'BILL_REMINDER' ? lastAiMessage.actionPayload?.billId : null;

    const proactiveReminder = reminders.find(r => 
      !r.isPaid && 
      (r.id === billIdFromPayload || lowerText.includes(r.description.toLowerCase()) || (lastAiMessage?.text.includes(r.description)))
    );

    if (proactiveReminder && (lowerText.includes('sim') || lowerText.includes('paguei') || lowerText.includes('já') || lowerText === 's')) {
      setIsLoading(true);
      await sendMessage(text.trim(), 'user');
      
      const result = await dispatchEvent(user.uid, {
        type: 'PAY_REMINDER',
        payload: {
          billId: proactiveReminder.id,
          paymentMethod: 'PIX', // Default
          confirmedBy: user.uid
        },
        source: 'chat',
        createdAt: new Date()
      });

      if (result.success) {
        await sendMessage(`Perfeito! Marquei **${proactiveReminder.description}** como pago e atualizei seu dashboard. ✅`, 'ai');
      } else {
        await sendMessage("Tive um problema ao marcar como pago. Tente novamente em instantes.", 'ai');
      }
      setIsLoading(false);
      return;
    }
    
    const uid = user.uid || auth.currentUser?.uid;
    if (!uid) {
      console.error("GB Chat: UID não encontrado para envio.");
      return;
    }

    console.log(`GB Chat: handleSend recebido: "${text}"`);
    isProcessingRef.current = true;
    await sendMessage(text.trim(), 'user');
    setIsLoading(true);

    try {
      // No passo 3 do onboarding, não avançamos apenas por "responder" algo genérico.
      // O avanço deve ser via confirmação/negação do salário no fluxo específico (handleSalaryConfirm).
      // Removido o bloco que marcava chatContextResponded como true aqui.

      // 1. Buscar contexto ATUALIZADO do Firestore (Fonte da Verdade)
      console.log("GB Chat: Buscando contexto atualizado...");
      const freshContext = await fetchChatContext(uid);
      const finalContext = freshContext 
        ? { ...freshContext, userPatterns: categoryPatterns } 
        : { user, reminders, cards, wallets, categories, transactions, goals, limits, debts, userPatterns: categoryPatterns };

      // Parser Determinístico (Dica para a IA e Safety Net)
      const parserHint = parseFinancialMessage(text.trim());

      // 2. Processar com Gemini
      console.log("GB Chat: Chamando Gemini API...");
      const result = await parseMessage(text.trim(), user.name || 'Usuário', finalContext);
      console.log("GB Chat: Gemini respondeu:", result);
      
      let finalEvents = result.events || [];

      // Safety Net: Se a IA falhou mas o parser tem alta confiança, usamos o parser
      if (finalEvents.length === 0 && parserHint.confidence > 0.8 && parserHint.type !== 'unknown') {
        console.log("GB Chat: Usando Safety Net (Parser Hint)");
        finalEvents = [{
          type: parserHint.type === 'expense' ? 'ADD_EXPENSE' : (parserHint.type === 'income' ? 'ADD_INCOME' : 'TRANSFER_WALLET'),
          payload: {
            amount: parserHint.amount,
            description: parserHint.description,
            category: parserHint.categoryHint || 'Outros',
            sourceWalletName: parserHint.fromWallet,
            targetWalletName: parserHint.toWallet,
            date: new Date().toISOString().split('T')[0]
          }
        }];
      }

      if (finalEvents.length > 0) {
        console.log(`GB Chat: Detectados ${finalEvents.length} eventos.`);
        if (finalEvents.length === 1) {
          setPendingAction(finalEvents[0]);
          setPendingEvents([]);
        } else {
          setPendingEvents(finalEvents);
          setPendingAction(null);
        }
      }

      // 3. Enviar resposta da IA para o Firestore
      await sendMessage(result.reply || "Entendido. ✅", 'ai');

    } catch (e) {
      console.error("GB Chat: Erro no processamento:", e);
      await sendMessage("Houve um pequeno erro na análise, mas anotei sua intenção. Pode repetir? 😅", 'ai');
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleSendFile = async (file: File) => {
    if (isLoading) return;
    
    setIsLoading(true);
    await sendMessage(`📎 Enviou arquivo: ${file.name}`, 'user');

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
        await sendMessage(`Li seu extrato${bankInfo}! Encontrei ${events.length} lançamentos. Confira a prévia abaixo.`, 'ai');
      } else {
        await sendMessage("Não consegui encontrar transações nesse arquivo.", 'ai');
      }
    } catch (error) {
      await sendMessage("Houve um erro ao processar seu arquivo.", 'ai');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAllEvents = async (id: string, isCard: boolean = false) => {
    const selectedEvents = pendingEvents.filter(ev => ev.payload.selected);
    if (selectedEvents.length === 0) return;

    setIsLoading(true);
    try {
      // 1. Deduplicar e criar novas categorias se necessário
      const newCategoryNames: string[] = Array.from(new Set(
        selectedEvents
          .map(e => e.payload.category?.trim())
          .filter((name): name is string => !!name && name.length > 0 && name.toLowerCase() !== 'outros')
          .filter(name => !categories.find(c => c.name.toLowerCase() === name.toLowerCase()))
      ));

      const { getCategoryId } = await import('../services/categoryService');

      for (const catName of newCategoryNames) {
        const slugId = getCategoryId(catName);
        await dispatchEvent(user.uid, {
          type: 'CREATE_CATEGORY',
          payload: { id: slugId, name: catName, color: '#00A884', icon: '📁' },
          source: 'chat',
          createdAt: new Date()
        });
      }

      // 2. Processar eventos
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
      await sendMessage(`✅ Sucesso! Importei ${selectedEvents.length} lançamentos para sua conta (${name}).`, 'ai');
      setPendingEvents([]);
    } catch (e) {
      console.error("GB Chat: Erro ao confirmar eventos em lote:", e);
      await sendMessage("Ocorreu um erro ao salvar alguns lançamentos.", 'ai');
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
    if (!pendingAction || isLoading) return;

    if (isExpired) {
      await sendMessage("Ação bloqueada. Seu período de teste expirou. 😔", 'ai');
      setPendingAction(null);
      setPendingEvents([]);
      return;
    }

    // Gerar uma chave única para esta operação específica para evitar duplicidade
    const operationKey = `CONFIRM_${pendingAction.type}_${pendingAction.payload.amount}_${pendingAction.payload.description?.substring(0, 20)}_${Date.now()}`;

    setIsLoading(true);
    try {
      const eventToDispatch = { ...pendingAction, operationKey };
      
      // Aprender padrão de categoria
      if (eventToDispatch.payload.description && eventToDispatch.payload.category) {
        await learnCategoryPattern(user.uid, eventToDispatch.payload.description, eventToDispatch.payload.category);
      }

      if (pendingAction.payload.reminderId) {
        await dispatchEvent(user.uid, {
          type: 'PAY_REMINDER',
          operationKey,
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
      } else if (pendingAction.type === 'TRANSFER_WALLET') {
        // Transferência já tem origem e destino identificados pela IA ou parser
        await dispatchEvent(user.uid, {
          ...pendingAction,
          operationKey,
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
          }
          eventToDispatch.payload.confirmedBy = user.uid;
        }

        await dispatchEvent(user.uid, {
          ...eventToDispatch,
          source: 'chat',
          createdAt: new Date()
        });
      }

      let feedback = '';
      const amountFormatted = formatCurrency(pendingAction.payload.amount);

      if (pendingAction.type === 'TRANSFER_WALLET') {
        const from = pendingAction.payload.sourceWalletName || pendingAction.payload.fromWalletName || 'Origem';
        const to = pendingAction.payload.targetWalletName || pendingAction.payload.toWalletName || 'Destino';
        feedback = `✅ Transferência realizada!\n\n${amountFormatted} de ${from} para ${to}.`;
      } else {
        const name = isCard ? cards.find(c => c.id === id)?.name || 'Cartão' : wallets.find(w => w.id === id)?.name || 'Carteira';
        const typeLabel = pendingAction.type === 'ADD_INCOME' ? 'Recebimento registrado' : 'Gasto anotado com sucesso';
        feedback = `${typeLabel} ✅\n\n${amountFormatted} — ${pendingAction.payload.description}\nCarteira: ${name}\nCategoria: ${pendingAction.payload.category}`;
      }
      
      await sendMessage(feedback, 'ai');
      setPendingAction(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const isOnboardingStep3 = user.onboardingStatus?.step === 3 && !user.onboardingStatus?.chatContextResponded;

  return (
    <div className="flex-1 flex flex-col w-full bg-transparent overflow-hidden relative min-h-0">
      {/* Header do Chat (Estilo WhatsApp) */}
      <div className="shrink-0 h-16 bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-4 gap-3 z-20 shadow-sm">
        {!isOnboardingStep3 && (
          <button 
            onClick={onToggleSidebar}
            className="w-10 h-10 flex items-center justify-center bg-[var(--green-whatsapp)] text-white rounded-full hover:bg-[var(--green-whatsapp-dark)] transition-all active:scale-90 shadow-lg shrink-0"
          >
            <span className="text-xl font-black italic">$</span>
          </button>
        )}

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

        {!isOnboardingStep3 && (
          <button 
            onClick={onOpenProfile}
            className="w-10 h-10 bg-[var(--bg-body)] rounded-full border border-[var(--border)] flex items-center justify-center overflow-hidden shadow-md active:scale-95 transition-all shrink-0"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--green-whatsapp)]/20">
                <span className="text-sm font-black text-[var(--green-whatsapp)]">{(user.name || 'U').charAt(0).toUpperCase()}</span>
              </div>
            )}
          </button>
        )}
      </div>

      {/* Mensagens */}
      <div 
        ref={scrollRef} 
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain relative z-10 no-scrollbar"
        style={{ scrollBehavior: 'smooth' }}
      >
        {isOnboardingStep3 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 px-4 text-center animate-fade">
             <div className="w-20 h-20 rounded-full bg-[var(--green-whatsapp)]/10 flex items-center justify-center mb-4">
                <span className="text-4xl">💰</span>
             </div>
             
             {messages.filter(m => m.sender === 'ai').slice(-1).map(msg => (
               <div key={msg.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-xl max-w-md w-full">
                 <p className="text-[var(--text-primary)] font-bold text-lg leading-tight mb-6">
                   {msg.text.replace(/\*\*/g, '')}
                 </p>
                 
                 <div className="flex gap-3">
                   <button 
                     onClick={() => handleSalaryConfirm(true)}
                     className="flex-1 bg-[var(--green-whatsapp)] text-white py-4 rounded-2xl font-black text-xs uppercase transition-all active:scale-95 shadow-lg shadow-[var(--green-whatsapp)]/20"
                   >
                     Sim, recebi
                   </button>
                   <button 
                     onClick={() => handleSalaryConfirm(false)}
                     className="flex-1 bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)] py-4 rounded-2xl font-black text-xs uppercase transition-all active:scale-95"
                   >
                     Ainda não
                   </button>
                 </div>
               </div>
             ))}
             
             <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] opacity-50">
               Modo de Captação Onboarding Ativo
             </p>
          </div>
        ) : (
          <>
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
                      if (!msg.createdAt) return '';
                      const d = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
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
          </>
        )}

        {pendingEvents.length > 0 && (
          <div className="flex flex-col items-start gap-2 animate-fade-in-up w-full">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-6 shadow-2xl w-full max-w-[98%] mx-auto overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--green-whatsapp)] to-emerald-400 opacity-20"></div>
              
              <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex flex-col">
                  <h4 className="text-sm font-black text-[var(--text-primary)] uppercase italic tracking-tight">Prévia de Importação</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-[var(--bg-body)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                      {pendingEvents.filter(e => e.payload.selected).length} de {pendingEvents.length} itens
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setPendingEvents(prev => prev.map(e => ({ ...e, payload: { ...e.payload, selected: true } })))}
                        className="text-[8px] font-black text-[var(--green-whatsapp)] hover:opacity-70 uppercase tracking-tighter"
                      >
                        Selecionar Tudo
                      </button>
                      <button 
                        onClick={() => setPendingEvents(prev => prev.map(e => ({ ...e, payload: { ...e.payload, selected: false } })))}
                        className="text-[8px] font-black text-rose-500 hover:opacity-70 uppercase tracking-tighter"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setPendingEvents([])} 
                  className="w-8 h-8 flex items-center justify-center bg-[var(--bg-body)] rounded-xl text-[var(--text-muted)] hover:text-rose-500 transition-all border border-[var(--border)] shadow-sm active:scale-90"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="max-h-[380px] overflow-y-auto space-y-3 mb-6 pr-1 no-scrollbar">
                {pendingEvents.map((ev, idx) => (
                  <div 
                    key={idx} 
                    className={`bg-[var(--bg-body)] p-4 rounded-2xl border transition-all relative group ${ev.payload.selected ? (ev.payload.isDuplicate ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border)] shadow-sm') : 'opacity-40 border-transparent grayscale scale-[0.98]'}`}
                  >
                    <div className="flex gap-4 items-start">
                      <button 
                        onClick={() => updatePendingEvent(idx, { selected: !ev.payload.selected })}
                        className={`mt-1 w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${ev.payload.selected ? 'bg-[var(--green-whatsapp)] border-[var(--green-whatsapp)] text-white shadow-lg shadow-[var(--green-whatsapp)]/20' : 'border-[var(--border)] bg-transparent'}`}
                      >
                        {ev.payload.selected && <Check size={12} strokeWidth={4} />}
                      </button>

                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex justify-between items-start">
                          <input 
                            type="text"
                            value={ev.payload.date}
                            onChange={(e) => updatePendingEvent(idx, { date: e.target.value })}
                            className="bg-transparent text-[10px] font-black text-[var(--text-muted)] uppercase tracking-tighter w-24 outline-none focus:text-[var(--green-whatsapp)]"
                          />
                          <input 
                            type="text"
                            value={ev.payload.amount}
                            onChange={(e) => updatePendingEvent(idx, { amount: parseFloat(e.target.value) || 0 })}
                            className={`bg-transparent text-base font-black text-right w-28 outline-none focus:ring-2 ring-[var(--green-whatsapp)]/20 rounded-lg px-2 transition-all ${ev.type === 'ADD_INCOME' ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}
                          />
                        </div>

                        <input 
                          type="text"
                          value={ev.payload.description}
                          onChange={(e) => updatePendingEvent(idx, { description: e.target.value })}
                          className="w-full bg-transparent text-xs font-bold text-[var(--text-primary)] outline-none focus:text-[var(--green-whatsapp)] border-b border-transparent focus:border-[var(--green-whatsapp)]/20 pb-0.5"
                        />

                        <div className="flex flex-col gap-2 pt-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {sortedCategories.slice(0, 4).map(c => (
                              <button 
                                key={c.id}
                                onClick={() => updatePendingEvent(idx, { category: c.name, isNewCategory: false })}
                                className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all border ${ev.payload.category === c.name ? 'bg-[var(--green-whatsapp)] text-white border-[var(--green-whatsapp)] shadow-md' : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--green-whatsapp)]'}`}
                              >
                                {c.name}
                              </button>
                            ))}
                            <select 
                              value={sortedCategories.find(c => c.name === ev.payload.category) ? ev.payload.category : 'NEW'}
                              onChange={(e) => {
                                if (e.target.value === 'NEW') {
                                  updatePendingEvent(idx, { category: '', isNewCategory: true });
                                } else {
                                  updatePendingEvent(idx, { category: e.target.value, isNewCategory: false });
                                }
                              }}
                              className="bg-[var(--surface)] px-2 py-1 rounded-lg text-[8px] font-black uppercase italic text-[var(--green-whatsapp)] outline-none border border-[var(--border)] focus:border-[var(--green-whatsapp)]"
                            >
                              <option value="" disabled>Mais...</option>
                              {sortedCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              <option value="NEW">+ Nova</option>
                            </select>
                            
                            {ev.payload.isCardCharge && (
                              <span className="text-[7px] font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full border border-rose-100 uppercase">Cartão</span>
                            )}
                            
                            {ev.payload.isDuplicate && (
                              <span className="text-[7px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 uppercase">Duplicado?</span>
                            )}
                          </div>

                          {(ev.payload.isNewCategory || !sortedCategories.find(c => c.name === ev.payload.category)) && (
                            <div className="flex gap-1 animate-fade-in">
                              <input 
                                type="text"
                                placeholder="Nova categoria..."
                                value={ev.payload.category}
                                onChange={(e) => updatePendingEvent(idx, { category: e.target.value })}
                                className="flex-1 bg-[var(--surface)] border border-[var(--green-whatsapp)]/30 rounded-xl px-3 py-2 text-[10px] font-bold text-[var(--green-whatsapp)] outline-none placeholder:text-[var(--text-muted)]/40"
                                autoFocus
                              />
                              <button 
                                onClick={() => updatePendingEvent(idx, { isNewCategory: false, category: 'Outros' })}
                                className="text-[var(--text-muted)] p-2 hover:text-rose-500 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={() => removePendingEvent(idx)}
                        className="text-[var(--text-muted)] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-sm"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[var(--bg-body)] rounded-[1.5rem] p-5 border border-[var(--border)] shadow-inner">
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 text-center">
                  {isSelectingCard ? 'Escolha o Cartão:' : `Confirmar ${pendingEvents.filter(e => e.payload.selected).length} itens em:`}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {isSelectingCard ? (
                    <>
                      {cards.map(card => (
                        <button 
                          key={card.id}
                          onClick={() => confirmAllEvents(card.id, true)}
                          className="bg-[var(--surface)] hover:bg-rose-500/5 hover:border-rose-500 border border-[var(--border)] rounded-2xl py-3 px-3 text-[10px] font-black uppercase transition-all active:scale-95 flex items-center gap-3 group"
                        >
                          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors">
                            <CreditCard size={14} />
                          </div>
                          <span className="truncate flex-1 text-left tracking-tighter">{card.name}</span>
                        </button>
                      ))}
                      <button 
                        onClick={() => setIsSelectingCard(false)}
                        className="col-span-2 bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)] rounded-xl py-2.5 text-[9px] font-black uppercase transition-all active:scale-95"
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
                          className="bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--green-whatsapp)] hover:bg-[var(--green-whatsapp)]/5 rounded-2xl py-3 px-3 text-[10px] font-black uppercase transition-all active:scale-95 flex items-center gap-3 group"
                        >
                          <div className="w-8 h-8 rounded-xl bg-[var(--bg-body)] text-[var(--text-muted)] flex items-center justify-center group-hover:bg-[var(--green-whatsapp)] group-hover:text-white transition-colors text-base">
                            {w.icon || '💰'}
                          </div>
                          <span className="truncate flex-1 text-left tracking-tighter">{w.name}</span>
                        </button>
                      ))}
                      {cards.length > 0 && (
                        <button 
                          onClick={() => {
                            if (cards.length === 1) confirmAllEvents(cards[0].id, true);
                            else setIsSelectingCard(true);
                          }}
                          className="bg-[var(--surface)] hover:bg-rose-500/5 hover:border-rose-500 border border-[var(--border)] rounded-2xl py-3 px-3 text-[10px] font-black uppercase transition-all active:scale-95 flex items-center gap-3 group"
                        >
                          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors">
                            <CreditCard size={14} />
                          </div>
                          <span className="flex-1 text-left tracking-tighter">Cartão de Crédito</span>
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
          <div className="flex flex-col items-start gap-2 animate-fade-in-up w-full">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] p-8 shadow-2xl w-full max-w-[95%] mx-auto overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--green-whatsapp)] to-emerald-400 opacity-30"></div>
              
              {/* Cabeçalho */}
              <div className="mb-8 text-center">
                <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Confirmar categoria</h3>
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mt-1">Escolha a categoria desse gasto</p>
              </div>
              
              {/* Card Resumo Premium */}
              <div className="bg-[var(--bg-body)] rounded-3xl p-6 border border-[var(--border)] mb-8 shadow-inner relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Tag size={40} />
                </div>
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Valor</span>
                      <span className={`text-3xl font-black tracking-tighter ${pendingAction.type === 'ADD_INCOME' ? 'text-[var(--green-whatsapp)]' : 'text-rose-500'}`}>
                        {pendingAction.type === 'ADD_INCOME' ? '+' : '-'}{formatCurrency(pendingAction.payload.amount)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Carteira</span>
                      <div className="flex items-center gap-2 bg-[var(--surface)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
                        <span className="text-xs">{pendingAction.payload.cardId ? '💳' : '💰'}</span>
                        <span className="text-[10px] font-black uppercase text-[var(--text-primary)]">
                          {isSelectingCard ? 'Selecionando...' : (
                            pendingAction.payload.cardId 
                              ? (cards.find(c => c.id === pendingAction.payload.cardId)?.name || 'Cartão')
                              : (wallets.find(w => w.id === (pendingAction.payload.sourceWalletId || pendingAction.payload.targetWalletId))?.name || 
                                 wallets.find(w => w.name.toLowerCase() === (pendingAction.payload.sourceWalletName || pendingAction.payload.targetWalletName || '').toLowerCase())?.name ||
                                 'Principal')
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-[var(--border)]/50">
                    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 block">Descrição</span>
                    <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{pendingAction.payload.description || 'Sem descrição'}</p>
                  </div>
                </div>
              </div>

              {/* Seção de Categorias */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Categorias</span>
                  <span className="text-[9px] font-bold text-[var(--green-whatsapp)] uppercase">{sortedCategories.length} disponíveis</span>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto no-scrollbar p-1">
                  {sortedCategories.map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => {
                        setPendingAction({
                          ...pendingAction,
                          payload: { ...pendingAction.payload, category: cat.name, isNewCategory: false }
                        });
                        setIsCreatingNewCategory(false);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group ${pendingAction.payload.category === cat.name ? 'bg-[var(--green-whatsapp)] border-[var(--green-whatsapp)] text-white shadow-lg shadow-[var(--green-whatsapp)]/20' : 'bg-[var(--bg-body)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--green-whatsapp)]/50'}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${pendingAction.payload.category === cat.name ? 'bg-white/20' : 'bg-[var(--surface)] text-[var(--text-muted)] group-hover:text-[var(--green-whatsapp)]'}`}>
                        {/* Aqui poderíamos ter um helper para ícones, mas vamos usar o nome por enquanto ou um ícone padrão */}
                        <Tag size={14} />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-tight truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>

                {/* Ação para Nova Categoria */}
                <div className="pt-2">
                  {!isCreatingNewCategory ? (
                    <button 
                      onClick={() => setIsCreatingNewCategory(true)}
                      className="w-full py-4 rounded-2xl border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--green-whatsapp)] hover:text-[var(--green-whatsapp)] transition-all flex items-center justify-center gap-2 group"
                    >
                      <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Criar nova categoria</span>
                    </button>
                  ) : (
                    <div className="bg-[var(--bg-body)] p-4 rounded-3xl border border-[var(--green-whatsapp)]/30 animate-fade-in space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[9px] font-black text-[var(--green-whatsapp)] uppercase tracking-widest">Nova Categoria</span>
                        <button onClick={() => setIsCreatingNewCategory(false)} className="text-[var(--text-muted)] hover:text-rose-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Ex: Presentes, Obra..."
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateCategoryInline();
                          }}
                          className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-[var(--green-whatsapp)] text-[var(--text-primary)]"
                          autoFocus
                        />
                        <button 
                          onClick={handleCreateCategoryInline}
                          className="bg-[var(--green-whatsapp)] text-white px-4 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Seleção de Carteira */}
                <div className="space-y-4 pt-4 border-t border-[var(--border)]/50">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Onde salvar?</span>
                    <span className="text-[9px] font-bold text-[var(--green-whatsapp)] uppercase">Escolha a carteira</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {wallets.map(w => {
                      const isSelected = pendingAction.payload.sourceWalletId === w.id || 
                                       pendingAction.payload.targetWalletId === w.id ||
                                       (!pendingAction.payload.sourceWalletId && !pendingAction.payload.targetWalletId && !pendingAction.payload.cardId && 
                                        (pendingAction.payload.sourceWalletName || pendingAction.payload.targetWalletName || '').toLowerCase() === w.name.toLowerCase());
                      
                      return (
                        <button 
                          key={w.id}
                          onClick={() => {
                            const update = pendingAction.type === 'ADD_INCOME' 
                              ? { targetWalletId: w.id, sourceWalletId: null, cardId: null, paymentMethod: 'PIX' }
                              : { sourceWalletId: w.id, targetWalletId: null, cardId: null, paymentMethod: 'PIX' };
                            setPendingAction({
                              ...pendingAction,
                              payload: { ...pendingAction.payload, ...update }
                            });
                          }}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group ${isSelected ? 'bg-[var(--green-whatsapp)] border-[var(--green-whatsapp)] text-white shadow-lg shadow-[var(--green-whatsapp)]/20' : 'bg-[var(--bg-body)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--green-whatsapp)]/50'}`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-white/20' : 'bg-[var(--surface)] text-[var(--text-muted)] group-hover:text-[var(--green-whatsapp)]'}`}>
                            <span className="text-base">{w.icon || '💰'}</span>
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-tight truncate">{w.name}</span>
                        </button>
                      );
                    })}
                    
                    {cards.length > 0 && (
                      <button 
                        onClick={() => {
                          const cardId = cards[0].id;
                          setPendingAction({
                            ...pendingAction,
                            payload: { 
                              ...pendingAction.payload, 
                              cardId, 
                              sourceWalletId: null, 
                              targetWalletId: null, 
                              paymentMethod: 'CARD' 
                            }
                          });
                        }}
                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group ${pendingAction.payload.cardId ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-[var(--bg-body)] border-[var(--border)] text-[var(--text-primary)] hover:border-rose-500/50'}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${pendingAction.payload.cardId ? 'bg-white/20' : 'bg-rose-500/10 text-rose-500 group-hover:text-rose-500'}`}>
                          <CreditCard size={14} />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-tight truncate">Cartão</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Botão Final de Confirmação */}
              <div className="mt-10">
                <button 
                  onClick={() => {
                    const id = pendingAction.payload.cardId || 
                             pendingAction.payload.sourceWalletId || 
                             pendingAction.payload.targetWalletId || 
                             wallets.find(w => w.name.toLowerCase() === (pendingAction.payload.sourceWalletName || pendingAction.payload.targetWalletName || '').toLowerCase())?.id ||
                             wallets[0]?.id || '';
                    const isCard = !!pendingAction.payload.cardId;
                    confirmPendingAction(id, isCard);
                  }}
                  disabled={isLoading}
                  className="w-full bg-[var(--green-whatsapp)] text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-[var(--green-whatsapp)]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Confirmar categoria</span>
                      <Check size={18} className="group-hover:scale-125 transition-transform" />
                    </>
                  )}
                </button>
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
      {!isOnboardingStep3 && (
        <div className={highlightInput ? 'onboarding-highlight' : ''}>
          <ChatComposer 
            onSendText={(text) => handleSend(text)} 
            onSendFile={(file) => handleSendFile(file)}
            isLoading={isLoading || !!pendingAction || pendingEvents.length > 0}
          />
        </div>
      )}
    </div>
  );
};

export default ChatInterface;