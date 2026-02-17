
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
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
          enum: ['ADD_EXPENSE', 'ADD_INCOME', 'CREATE_GOAL', 'UPDATE_LIMIT', 'CREATE_REMINDER', 'ADD_CARD_CHARGE', 'PAY_CARD'] 
        },
        payload: { 
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            paymentMethod: { type: Type.STRING, enum: ['CASH', 'PIX', 'CARD'] },
            cardId: { type: Type.STRING },
            dueDay: { type: Type.NUMBER }
          }
        }
      },
      required: ["type", "payload"]
    },
    reply: { type: Type.STRING }
  },
  required: ["reply"]
};

export const parseMessage = async (text: string, userName: string) => {
  try {
    const ai = getAI();
    if (!ai) return { reply: "IA Indisponível." };

    const today = new Date().toISOString().split('T')[0];
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é o GB, mentor financeiro de ${userName}. Hoje é ${today}.
      
      REGRAS DE MAPEAMENTO:
      - "Gastei 50 no cartão": type='ADD_CARD_CHARGE', cardId='default'
      - "Gastei 50 em dinheiro/pix": type='ADD_EXPENSE'
      - "Paguei a fatura do cartão de 300": type='PAY_CARD', cardId='default', amount=300
      - "Limite de X para categoria Y": type='UPDATE_LIMIT'
      - "Lembrete de conta Z dia W": type='CREATE_REMINDER'
      
      REPOSTA (reply):
      Confirme o valor, categoria e diga onde foi refletido.
      Ex: "✅ Feito! R$ 50 em Lanches. Atualizado no seu Dashboard e Limites."
      Ex 2: "💳 Anotado! Gasto de R$ 120 no Cartão. Refletido no extrato do Cartão (não abate do saldo livre agora)."
      
      MENSAGEM: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: FINANCE_PARSER_SCHEMA
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { reply: "Entendi. Pode me dar os detalhes para eu registrar?" };
  }
};
