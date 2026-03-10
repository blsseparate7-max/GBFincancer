
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const v1 = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  const v2 = process.env.GEMINI_API_KEY;
  const v3 = process.env.API_KEY;

  console.log("GB Debug - Verificando chaves:");
  console.log("- VITE_GEMINI_API_KEY:", v1 ? "Presente (começa com " + v1.substring(0, 4) + ")" : "Ausente");
  console.log("- process.env.GEMINI_API_KEY:", v2 ? "Presente" : "Ausente");
  console.log("- process.env.API_KEY:", v3 ? "Presente" : "Ausente");

  const apiKey = v1 || v2 || v3;
  
  if (!apiKey || apiKey === 'undefined' || apiKey === '' || apiKey === 'null') {
    return null;
  }
  
  return new GoogleGenAI({ apiKey });
};

const FINANCE_PARSER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    event: {
      type: Type.OBJECT,
      properties: {
        type: { 
          type: Type.STRING, 
          enum: [
            'ADD_EXPENSE', 'ADD_INCOME', 'CREATE_GOAL', 'ADD_TO_GOAL', 
            'UPDATE_LIMIT', 'CREATE_REMINDER', 'ADD_CARD_CHARGE', 
            'PAY_CARD', 'TRANSFER_WALLET', 'CREATE_CATEGORY', 
            'UPDATE_CATEGORY', 'DELETE_CATEGORY', 'MOVE_TRANSACTION_CATEGORY'
          ] 
        },
        payload: { 
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            paymentMethod: { type: Type.STRING, enum: ['CASH', 'PIX', 'CARD'] },
            cardId: { type: Type.STRING },
            dueDay: { type: Type.NUMBER },
            name: { type: Type.STRING },
            targetAmount: { type: Type.NUMBER },
            location: { type: Type.STRING },
            goalId: { type: Type.STRING },
            fromWalletId: { type: Type.STRING },
            toWalletId: { type: Type.STRING },
            note: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['PAY', 'RECEIVE'] },
            id: { type: Type.STRING },
            newName: { type: Type.STRING },
            oldName: { type: Type.STRING },
            transactionId: { type: Type.STRING },
            newCategory: { type: Type.STRING }
          }
        }
      },
      required: ["type", "payload"]
    },
    reply: { type: Type.STRING }
  },
  required: ["reply"]
};

export const parseMessage = async (text: string, userName: string, context?: { reminders?: any[], cards?: any[], wallets?: any[], categories?: any[], transactions?: any[], goals?: any[], limits?: any[] }) => {
  try {
    const ai = getAI();
    if (!ai) return { reply: "IA Indisponível." };

    const today = new Date().toISOString().split('T')[0];
    
    // Contexto de Categorias
    const categoriesContext = context?.categories && context.categories.length > 0 ?
      `CATEGORIAS DO USUÁRIO: ${JSON.stringify(context.categories.map(c => ({ id: c.id, nome: c.name, tipo: c.type })))}` :
      'Nenhuma categoria personalizada cadastrada ainda.';

    // Contexto de Metas
    const goalsContext = context?.goals && context.goals.length > 0 ?
      `METAS DE ECONOMIA: ${JSON.stringify(context.goals.map(g => ({ id: g.id, nome: g.name, alvo: g.targetAmount, atual: g.currentAmount, progresso: ((g.currentAmount / g.targetAmount) * 100).toFixed(1) + '%' })))}` :
      'Sem metas cadastradas.';

    // Contexto de Limites
    const limitsContext = context?.limits && context.limits.length > 0 ?
      `LIMITES DE GASTOS: ${JSON.stringify(context.limits.map(l => ({ categoria: l.category, limite: l.limit, gasto: l.spent, disponivel: l.limit - l.spent })))}` :
      'Sem limites configurados.';

    // Contexto de Transações Recentes (para mover categorias ou resumos)
    const recentTransactions = context?.transactions ? 
      `TRANSAÇÕES RECENTES: ${JSON.stringify(context.transactions.slice(-15).map(t => ({ id: t.id, desc: t.description, valor: t.amount, cat: t.category, data: t.date })))}` :
      'Sem transações recentes.';

    // Resumo por Categoria (para responder perguntas de quanto gastou)
    const categorySummary = context?.transactions ? 
      (() => {
        const summary: Record<string, { total: number, count: number }> = {};
        let totalMonth = 0;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        context.transactions.forEach(t => {
          const tDate = new Date(t.date);
          if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear && t.type === 'EXPENSE') {
            const cat = t.category || 'Outros';
            if (!summary[cat]) summary[cat] = { total: 0, count: 0 };
            summary[cat].total += t.amount;
            summary[cat].count += 1;
            totalMonth += t.amount;
          }
        });
        return `RESUMO GASTOS MÊS ATUAL (Total: R$ ${totalMonth.toFixed(2)}): ${JSON.stringify(summary)}`;
      })() : '';

    const remindersContext = context?.reminders ? 
      `CONTEXTO DE LEMBRETES (Contas a Pagar/Receber): ${JSON.stringify(context.reminders.map(r => ({ desc: r.description, valor: r.amount, dia: r.dueDay, pago: r.isPaid, tipo: r.type, categoria: r.category })))}` : 
      'Sem lembretes.';
    
    const cardsContext = context?.cards && context.cards.length > 0 ?
      `CARTÕES DE CRÉDITO (Faturas): ${JSON.stringify(context.cards.map(c => ({ id: c.id, nome: c.name, limite: c.limit, usado: c.usedAmount, disponivel: c.availableAmount, vencimento: c.dueDay })))}` :
      'Sem cartões.';

    const walletsContext = context?.wallets && context.wallets.length > 0 ?
      `CARTEIRAS: ${JSON.stringify(context.wallets.map(w => ({ id: w.id, nome: w.name, saldo: w.balance })))}` :
      'Sem carteiras.';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Você é o GB, mentor financeiro de ${userName}. Hoje é ${today}.
      
      ${categoriesContext}
      ${goalsContext}
      ${limitsContext}
      ${categorySummary}
      ${recentTransactions}
      ${remindersContext}
      ${cardsContext}
      ${walletsContext}

      REGRAS DE OURO (FONTE DA VERDADE):
      1. Você deve SEMPRE priorizar os dados acima sobre qualquer conversa anterior. Se o dado diz que está PAGO, está PAGO.
      2. Se o usuário perguntar sobre pendências, verifique os LEMBRETES onde "pago" é false.
      3. Se o usuário perguntar sobre metas, use o progresso real de "METAS DE ECONOMIA".
      4. Se o usuário perguntar sobre cartões, use "usado" e "disponivel" de "CARTÕES DE CRÉDITO".
      5. Se o usuário perguntar sobre saldo, use "CARTEIRAS".

      OBJETIVO: Analisar a mensagem e retornar um JSON com "reply" e opcionalmente "event".
      
      GESTÃO FINANCEIRA:
      1. GASTO NO CARTÃO: "gastei 50 no cartão", "comprei 100 no crédito" -> event: { type: "ADD_CARD_CHARGE", payload: { amount: 50, category: "...", description: "...", cardId: "ID_DO_CARTAO" } }
         - SEMPRE use ADD_CARD_CHARGE para gastos no crédito. Se houver mais de um cartão, escolha o mais provável ou o primeiro se não especificado.
      2. GASTO GERAL (PIX/DINHEIRO): "paguei 20 no pix", "gastei 10 em dinheiro" -> event: { type: "ADD_EXPENSE", payload: { amount: 20, category: "...", description: "...", paymentMethod: "PIX" } }
      3. RECEITA: "recebi 1000", "ganhei 50" -> event: { type: "ADD_INCOME", payload: { amount: 1000, category: "...", description: "..." } }
      
      GESTÃO DE CATEGORIAS:
      1. CRIAR: "criar categoria [NOME]" -> event: { type: "CREATE_CATEGORY", payload: { name: "[NOME]", type: "EXPENSE" } }
      2. RENOMEAR: "renomear [ANTIGO] para [NOVO]" -> event: { type: "UPDATE_CATEGORY", payload: { id: "ID_DA_CATEGORIA", name: "[NOVO]", oldName: "[ANTIGO]" } }
      3. MOVER GASTO: "mover gasto [DESC/VALOR] para [CATEGORIA]" -> event: { type: "MOVE_TRANSACTION_CATEGORY", payload: { transactionId: "ID_DA_TRANSACAO", newCategory: "[NOME_CATEGORIA]" } }
      4. REMOVER: "remover categoria [NOME]" -> event: { type: "DELETE_CATEGORY", payload: { id: "ID_DA_CAT", name: "[NOME]" } }
         - Se houver gastos na categoria (veja no RESUMO), avise o usuário no "reply" que os gastos serão movidos para "Outros".
      
      CONSULTAS:
      - Se o usuário perguntar quanto gastou em X, use os dados de "RESUMO GASTOS MÊS ATUAL" para responder no "reply" de forma clara.
      - Exemplo de resposta para resumo: "📊 Categoria Alimentação\nTotal no mês: R$ 480\nLançamentos: 8\nParticipação: 18%"
      
      REGRAS:
      - Sempre verifique se a categoria existe em "CATEGORIAS DO USUÁRIO" antes de renomear ou remover.
      - Para mover gastos, procure o ID da transação em "TRANSAÇÕES RECENTES". Se não encontrar, peça ao usuário para ser mais específico ou informe que só consegue mover gastos recentes pelo chat.
      
      MENSAGEM DO USUÁRIO: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: FINANCE_PARSER_SCHEMA
      }
    });

    if (!response.text) {
      throw new Error("Resposta da IA vazia");
    }

    const parsed = JSON.parse(response.text);
    console.log("GB Debug - IA Respondeu:", parsed);
    return parsed;
  } catch (e) {
    console.error("GB Debug - Erro na IA:", e);
    return { reply: "Entendi. Pode me dar os detalhes para eu registrar? (Houve um erro técnico na análise)" };
  }
};
