
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
          enum: ['ADD_EXPENSE', 'ADD_INCOME', 'CREATE_GOAL', 'ADD_TO_GOAL', 'UPDATE_LIMIT', 'CREATE_REMINDER', 'ADD_CARD_CHARGE', 'PAY_CARD', 'TRANSFER_WALLET'] 
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
            type: { type: Type.STRING, enum: ['PAY', 'RECEIVE'] }
          }
        }
      },
      required: ["type", "payload"]
    },
    reply: { type: Type.STRING }
  },
  required: ["reply"]
};

export const parseMessage = async (text: string, userName: string, context?: { reminders?: any[], cards?: any[], wallets?: any[], categories?: any[] }) => {
  try {
    const ai = getAI();
    if (!ai) return { reply: "IA Indisponível." };

    const today = new Date().toISOString().split('T')[0];
    const remindersContext = context?.reminders ? 
      `CONTEXTO DE LEMBRETES (Contas a vencer): ${JSON.stringify(context.reminders.map(r => ({ desc: r.description, valor: r.amount, dia: r.dueDay, pago: r.isPaid })))}` : 
      'Sem lembretes cadastrados.';
    
    const cardsContext = context?.cards && context.cards.length > 0 ?
      `CARTÕES DISPONÍVEIS: ${JSON.stringify(context.cards.map(c => ({ id: c.id, nome: c.name, banco: c.bank })))}` :
      'Nenhum cartão de crédito cadastrado pelo usuário ainda.';

    const walletsContext = context?.wallets && context.wallets.length > 0 ?
      `CARTEIRAS DISPONÍVEIS: ${JSON.stringify(context.wallets.map(w => ({ id: w.id, nome: w.name, saldo: w.balance })))}` :
      'Nenhuma carteira cadastrada ainda.';

    const categoriesContext = context?.categories && context.categories.length > 0 ?
      `CATEGORIAS DO USUÁRIO: ${JSON.stringify(context.categories.map(c => ({ nome: c.name, tipo: c.type })))}` :
      'Nenhuma categoria personalizada cadastrada ainda.';

    console.log("GB Debug - Enviando para IA:", text);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Você é o GB, mentor financeiro de ${userName}. Hoje é ${today}.
      
      ${remindersContext}
      ${cardsContext}
      ${walletsContext}
      ${categoriesContext}

      OBJETIVO: Analisar a mensagem e retornar um JSON com "reply" (texto para o usuário) e opcionalmente "event" (comando para o sistema).
      
      REGRAS IMPORTANTES:
      1. Se o usuário mencionar um gasto no CARTÃO DE CRÉDITO:
         - Verifique se existe um cartão correspondente em "CARTÕES DISPONÍVEIS".
         - Se existir, use o "id" exato desse cartão no campo "cardId".
         - Se NÃO existir nenhum cartão cadastrado, informe ao usuário que ele precisa cadastrar o cartão manualmente na aba "Cartão de Crédito" primeiro. NÃO tente criar um cartão novo.
      
      2. Se o usuário mencionar uma TRANSFERÊNCIA ou MOVIMENTAÇÃO entre contas/carteiras (ex: "transferi do nubank para dinheiro"):
         - Verifique se as carteiras de origem e destino existem em "CARTEIRAS DISPONÍVEIS".
         - Se existirem, use os IDs correspondentes em "fromWalletId" e "toWalletId".
         - Se a origem NÃO tiver saldo suficiente (verifique em "CARTEIRAS DISPONÍVEIS"), informe ao usuário: "⚠️ Saldo insuficiente na carteira [NOME]. Saldo atual: R$ [VALOR]".
         - Se não encontrar uma das carteiras, responda: "Não encontrei a carteira '[NOME]'. Quer criar agora?".
         - NÃO crie transações normais para transferências. Use o evento "TRANSFER_WALLET".
      
      3. CATEGORIAS:
         - Use preferencialmente as "CATEGORIAS DO USUÁRIO".
         - Se a categoria sugerida NÃO estiver na lista do usuário, use "Outros" ou sugira ao usuário criar a categoria na aba "Categorias".
         - Se o usuário não tiver categorias cadastradas, use categorias genéricas como: ALIMENTAÇÃO, TRANSPORTE, MORADIA, SAÚDE, EDUCAÇÃO, LAZER, PESSOAL, FINANCEIRO.
      
      EXEMPLOS DE EVENTOS:
      - "Gastei 50 no cartão": { "type": "ADD_CARD_CHARGE", "payload": { "amount": 50, "category": "ALIMENTAÇÃO", "description": "Gasto no Cartão", "cardId": "ID_DO_CARTAO_AQUI" } }
      - "Transferi 200 do nubank para dinheiro": { "type": "TRANSFER_WALLET", "payload": { "amount": 200, "fromWalletId": "ID_NUBANK", "toWalletId": "ID_DINHEIRO", "note": "Transferência via chat" } }
      - "Lembrar de receber 1000 de aluguel todo dia 10": { "type": "CREATE_REMINDER", "payload": { "amount": 1000, "description": "Aluguel", "dueDay": 10, "type": "RECEIVE" } }
      
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
