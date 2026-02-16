
import { GoogleGenAI, Type } from "@google/genai";
import { CustomerData } from "../types";

// Função auxiliar para inicializar a IA apenas quando necessário
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("ERRO CRÍTICO: Variável de ambiente API_KEY não configurada.");
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
          enum: ['ADD_EXPENSE', 'ADD_INCOME', 'CREATE_GOAL', 'UPDATE_LIMIT', 'CREATE_REMINDER', 'PAY_CARD'] 
        },
        payload: { 
          type: Type.OBJECT,
          description: "Dados financeiros da transação.",
          properties: {
            amount: { type: Type.NUMBER, description: "Valor numérico da transação ou do limite." },
            category: { type: Type.STRING, description: "Categoria (Alimentação, Transporte, Lazer, etc)." },
            description: { type: Type.STRING, description: "O que foi comprado ou recebido." },
            paymentMethod: { 
              type: Type.STRING, 
              enum: ['CASH', 'PIX', 'CARD'],
              description: "CASH para dinheiro/débito, PIX para pix, CARD para cartão de crédito." 
            },
            date: { type: Type.STRING, description: "Data no formato ISO (YYYY-MM-DD)." },
            cardId: { type: Type.STRING, description: "ID do cartão se o usuário mencionar um nome específico." },
            cardName: { type: Type.STRING, description: "Nome do cartão para pagamento de fatura." }
          }
        }
      },
      required: ["type", "payload"]
    },
    reply: { type: Type.STRING, description: "Resposta amigável do assistente." }
  },
  required: ["reply"]
};

export const parseMessage = async (text: string, userName: string) => {
  try {
    const ai = getAI();
    if (!ai) {
      return { reply: "O sistema de IA está temporariamente indisponível por falta de configuração de chave (API_KEY)." };
    }

    const today = new Date().toISOString().split('T')[0];
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é o GB, mentor financeiro do usuário ${userName}. Hoje é ${today}.
      
      REGRAS CRÍTICAS:
      1. COMPRA NO CARTÃO: Se o usuário disser "gastei X no cartão", use ADD_EXPENSE com paymentMethod "CARD". Isso não diminui o saldo no dashboard, apenas no limite do cartão.
      2. PAGAMENTO DE FATURA: Se o usuário disser "paguei a fatura", "liquidei o cartão", use PAY_CARD. Isso CRIA uma saída no dashboard e zera o saldo do cartão.
      3. Se ele mencionar "no cartão", "crédito", o paymentMethod DEVE ser "CARD".
      4. Se o usuário quiser limitar um gasto, o tipo é UPDATE_LIMIT.
      5. Se ele disser "Recebi", o tipo é ADD_INCOME.
      
      Mensagem: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: FINANCE_PARSER_SCHEMA
      }
    });

    const content = response.text || "{}";
    return JSON.parse(content);
  } catch (e) {
    console.error("Gemini Parse Error:", e);
    return { reply: "Entendi. Pode me confirmar o valor e o que deseja registrar?" };
  }
};

export const getCEOSummary = async (customers: CustomerData[]): Promise<string> => {
  try {
    const ai = getAI();
    if (!ai) return "Sistema de IA não configurado.";

    const summaryData = customers.map(c => ({
      userName: c.userName,
      status: c.status,
      plan: c.plan
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise estrategicamente a base de clientes do GBFinancer para o CEO: ${JSON.stringify(summaryData)}.`,
    });

    return response.text || "Sem análise disponível.";
  } catch (err) {
    console.error("CEO Summary Error:", err);
    return "Erro ao gerar o relatório analítico.";
  }
};
