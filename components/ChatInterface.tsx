
import React, { useState, useRef, useEffect } from 'react';
import { Message, Transaction, CategoryLimit, Bill, SavingGoal, Note, UserSession } from '../types';
import { processUserIntent, getFinancialReportResponse, AIResponse } from '../services/geminiService';

interface ChatInterfaceProps {
  user: UserSession;
  onTransactionDetected: (t: Transaction) => void;
  onGoalOperation: (nameOrType: string, amount: number, type: 'ADD' | 'REMOVE', metaHint?: string) => { success: boolean, feedback: string };
  onGoalDetected: (goal: { name: string; targetAmount: number; monthlySaving: number }) => void;
  onSetLimit: (config: { category: string; amount: number }) => void;
  onBillDetected: (bill: Omit<Bill, 'id' | 'isPaid'>) => void;
  onBillPayDetected?: (id: string) => void;
  onUpdateTransactionCategory?: (id: string, newCat: string) => void;
  transactions: Transaction[];
  budget: number;
  categoryLimits: CategoryLimit[];
  goals: SavingGoal[];
  notes: Note[];
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  categories: string[];
  onAddCategory?: (cat: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  user, onTransactionDetected, onBillDetected, onBillPayDetected, onUpdateTransactionCategory, 
  onGoalOperation, transactions, categoryLimits, goals, notes, messages, setMessages, categories, onAddCategory
}) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ 
        id: 'welcome', 
        text: `Olá ${user.name.split(' ')[0]}! Bem-vindo ao GBFinancer. 🛡️\n\nEstou pronto para organizar sua vida financeira. Que tal registrar seu primeiro gasto agora?\n\nExemplo: "Gastei 50 reais no mercado" ou "Paguei o aluguel hoje"`, 
        sender: 'ai', 
        timestamp: new Date() 
      }]);
    }
  }, []);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleAIResponse = async (response: AIResponse, originalText: string) => {
    let feedbackMsg = "";
    let lastTId = "";
    let suggestedCat = "";

    for (const action of response.actions) {
      if (action.suggestCategory && onAddCategory) {
        suggestedCat = action.suggestCategory;
        if (!categories.includes(suggestedCat)) {
          onAddCategory(suggestedCat);
          feedbackMsg += `🏷️ Categoria nova "${suggestedCat}" criada.\n`;
        }
      }

      if (action.intent === 'BILL' && action.billConfig) {
        onBillDetected({ 
          description: action.billConfig.description, 
          amount: action.billConfig.amount, 
          dueDate: action.billConfig.dueDate || new Date().toISOString(), 
          isRecurring: true, 
          frequency: 'MONTHLY', 
          remindersEnabled: true 
        });
        feedbackMsg += `📅 Gasto FIXO agendado: ${action.billConfig.description} (${formatCurrency(action.billConfig.amount)}). Estará na sua aba de Lembretes.\n`;
      } else if (action.intent === 'TRANSACTION' && action.transaction) {
        const tId = Math.random().toString(36);
        onTransactionDetected({ ...action.transaction, id: tId, date: new Date().toISOString(), paymentMethod: 'PIX' } as Transaction);
        lastTId = tId;
        feedbackMsg += `💸 Registrado: ${action.transaction.description} (${action.transaction.category}) - ${formatCurrency(action.transaction.amount)}\n`;
      } else if (action.intent === 'GOAL_OPERATION' && action.goalOperation) {
        const result = onGoalOperation(
          action.goalOperation.goalName || '',
          action.goalOperation.amount,
          action.goalOperation.operationType,
          action.goalOperation.metaHint || ''
        );
        // Feedback de economia já formatado pelo handleGoalOperation
        feedbackMsg += `${result.feedback}\n`;
      } else if (action.intent === 'QUERY') {
        const feedback = await getFinancialReportResponse(originalText, transactions, categoryLimits, goals, notes);
        feedbackMsg += feedback;
      }
    }

    if (feedbackMsg) {
      setMessages(p => [...p, { 
        id: Date.now().toString(), 
        text: feedbackMsg.trim(), 
        sender: 'ai', 
        timestamp: new Date(),
        categorySuggestion: suggestedCat,
        tempTransactionId: lastTId
      }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const msg = input;
    setMessages(p => [...p, { id: Date.now().toString(), text: msg, sender: 'user', timestamp: new Date() }]);
    setInput('');
    setIsTyping(true);
    try {
      const res = await processUserIntent(msg, categories, goals.map(g => g.name));
      await handleAIResponse(res, msg);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-full bg-[#e5ddd5] whatsapp-bg overflow-hidden relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-10 z-10">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[1.2rem] p-3 shadow-sm ${msg.sender === 'user' ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
              <p className="text-sm text-gray-900 leading-tight whitespace-pre-wrap font-medium">{msg.text}</p>
              
              {msg.billRefId && onBillPayDetected && (
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <button onClick={() => onBillPayDetected(msg.billRefId!)} className="flex-1 bg-emerald-500 text-white text-[9px] font-black py-2 rounded-lg uppercase">Paguei Agora ✅</button>
                  <button onClick={() => setMessages(p => p.filter(m => m.id !== msg.id))} className="flex-1 bg-slate-100 text-slate-400 text-[9px] font-black py-2 rounded-lg uppercase">Mais tarde</button>
                </div>
              )}

              {msg.categorySuggestion && msg.tempTransactionId && onUpdateTransactionCategory && (
                <div className="mt-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Ajustar Categoria?</p>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => setMessages(p => p.map(m => m.id === msg.id ? { ...m, categorySuggestion: undefined } : m))} className="px-2 py-1 bg-emerald-600 text-white text-[8px] font-black rounded uppercase">Manter {msg.categorySuggestion}</button>
                    {categories.filter(c => c !== msg.categorySuggestion).slice(0, 2).map(cat => (
                      <button key={cat} onClick={() => { onUpdateTransactionCategory(msg.tempTransactionId!, cat); setMessages(p => p.map(m => m.id === msg.id ? { ...m, categorySuggestion: undefined, text: m.text + ` (Ajustado para ${cat})` } : m)); }} className="px-2 py-1 bg-white border border-slate-200 text-slate-500 text-[8px] font-black rounded uppercase">{cat}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[9px] text-gray-400 text-right mt-1 font-bold">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isTyping && <div className="text-[10px] text-emerald-600 font-black ml-2 animate-pulse italic">GB analisando...</div>}
      </div>

      <div className="bg-[#f0f2f5] px-2 py-3 flex gap-2 items-center border-t border-gray-200 shrink-0 w-full z-[100] pb-safe">
        <div className="flex-1 bg-white rounded-full border border-gray-100 shadow-sm overflow-hidden flex items-center">
          <input className="w-full bg-transparent px-5 py-4 text-base focus:outline-none" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Mande uma mensagem..." />
        </div>
        <button onClick={handleSend} className="w-[56px] h-[56px] rounded-full flex items-center justify-center bg-[#075e54] shadow-lg active:scale-90 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
