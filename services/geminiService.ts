
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
          enum: ['ADD_EXPENSE', 'ADD_INCOME', 'CREATE_GOAL', 'ADD_TO_GOAL', 'UPDATE_LIMIT', 'CREATE_REMINDER', 'ADD_CARD_CHARGE', 'PAY_CARD'] 
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
            goalId: { type: Type.STRING }
          }
        }
      },
      required: ["type", "payload"]
    },
    reply: { type: Type.STRING }
  },
  required: ["reply"]
};

export const parseMessage = async (text: string, userName: string, context?: { reminders?: any[] }) => {
  try {
    const ai = getAI();
    if (!ai) return { reply: "IA Indisponível." };

    const today = new Date().toISOString().split('T')[0];
    const remindersContext = context?.reminders ? 
      `CONTEXTO DE LEMBRETES (Contas a vencer): ${JSON.stringify(context.reminders.map(r => ({ desc: r.description, valor: r.amount, dia: r.dueDay, pago: r.isPaid })))}` : 
      'Sem lembretes cadastrados.';
    
    console.log("GB Debug - Enviando para IA:", text);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Você é o GB, mentor financeiro de ${userName}. Hoje é ${today}.
      
      ${remindersContext}

      OBJETIVO: Analisar a mensagem e retornar um JSON com "reply" (texto para o usuário) e opcionalmente "event" (comando para o sistema).
      
      CATEGORIAS PERMITIDAS: ALIMENTAÇÃO, TRANSPORTE, MORADIA, SAÚDE, EDUCAÇÃO, LAZER, PESSOAL, FINANCEIRO.
      
      EXEMPLOS DE EVENTOS:
      - "Gastei 50 no cartão": { "type": "ADD_CARD_CHARGE", "payload": { "amount": 50, "category": "ALIMENTAÇÃO", "description": "Gasto no Cartão", "cardId": "default" } }
      - "Recebi 1000": { "type": "ADD_INCOME", "payload": { "amount": 1000, "category": "FINANCEIRO", "description": "Receita" } }
      - "Guardar 100 na meta Reserva": { "type": "ADD_TO_GOAL", "payload": { "amount": 100, "name": "Reserva" } }
      
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
