
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

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
    events: {
      type: Type.ARRAY,
      items: {
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
              newCategory: { type: Type.STRING },
              installments: { type: Type.NUMBER, description: "Número de parcelas para compras no cartão de crédito" }
            }
          }
        },
        required: ["type", "payload"]
      }
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

    // Contexto de Médias por Categoria (para detecção de gastos suspeitos)
    const categoryAverages = context?.transactions ? 
      (() => {
        const sums: Record<string, number> = {};
        const counts: Record<string, number> = {};
        context.transactions.forEach(t => {
          if (t.type === 'EXPENSE') {
            const cat = t.category || 'Outros';
            sums[cat] = (sums[cat] || 0) + t.amount;
            counts[cat] = (counts[cat] || 0) + 1;
          }
        });
        const averages: Record<string, number> = {};
        Object.keys(sums).forEach(cat => {
          averages[cat] = sums[cat] / counts[cat];
        });
        return `MÉDIAS DE GASTO POR CATEGORIA: ${JSON.stringify(averages)}`;
      })() : '';

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é o GB, mentor financeiro premium de ${userName}. Hoje é ${today}.
      
      ${categoriesContext}
      ${goalsContext}
      ${limitsContext}
      ${categorySummary}
      ${categoryAverages}
      ${recentTransactions}
      ${remindersContext}
      ${cardsContext}
      ${walletsContext}

      REGRAS DE OURO (FONTE DA VERDADE):
      1. Você deve SEMPRE priorizar os dados acima sobre qualquer conversa anterior.
      2. Se o usuário perguntar sobre pendências, verifique os LEMBRETES onde "pago" é false.
      
      INTELIGÊNCIA FINANCEIRA (UPGRADES):
      1. DETECÇÃO DE GASTOS SUSPEITOS:
      - Se o usuário registrar um gasto (ADD_EXPENSE ou ADD_CARD_CHARGE) que seja muito maior que a média da categoria (veja MÉDIAS DE GASTO POR CATEGORIA), inclua um aviso no "reply".
      - Se detectar gasto duplicado (mesmo valor, categoria e descrição no mesmo dia), avise.
      2. ALERTA DE RISCO:
      - Se os gastos do mês (RESUMO GASTOS MÊS ATUAL) estiverem próximos de 80% da renda (se houver lembretes de RECEIVE), alerte.
      - Se o saldo total (CARTEIRAS) estiver próximo de zero, alerte.
      3. PREVISÃO:
      - Se o usuário perguntar "como vou terminar o mês?", use os dados para estimar se o saldo será positivo ou negativo.
      4. PARCELAMENTO (CARTÃO DE CRÉDITO):
      - Se o usuário disser algo como "gastei 100 em 3x" ou "comprei 300 no cartão em 6x", você deve identificar que é uma compra parcelada.
      - O evento deve ser ADD_CARD_CHARGE.
      - O "amount" deve ser o VALOR TOTAL da compra.
      - O campo "installments" deve conter o número de parcelas (ex: 3 ou 6).

      OBJETIVO: Analisar a mensagem e retornar um JSON com "reply" e opcionalmente uma lista de "events".
      
      ESTILO DE RESPOSTA (PREMIUM):
      - Seja curto, profissional e visual.
      - Use emojis de forma elegante.
      - Máximo de 5 blocos de informação em resumos.
      
      MENSAGEM DO USUÁRIO: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: FINANCE_PARSER_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
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
