
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, SavingGoal, CustomerData, RecurrenceType, CategoryLimit, Note } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED");
    if (isQuotaError && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export interface AIAction {
  intent: 'TRANSACTION' | 'SET_LIMIT' | 'CREATE_GOAL' | 'GOAL_OPERATION' | 'BILL' | 'QUERY' | 'NOTE' | 'UNKNOWN';
  transaction?: {
    description: string;
    amount: number;
    category: string;
    type: 'INCOME' | 'EXPENSE' | 'SAVING' | 'INVESTMENT';
    isFixed?: boolean;
  };
  suggestCategory?: string; 
  billConfig?: {
    description: string;
    amount: number;
    dueDate: string;
    isRecurring: boolean;
    frequency: RecurrenceType;
  };
  goalOperation?: {
    goalName: string;
    metaHint: 'reserva' | 'casa_entrada' | 'carro' | 'outro';
    amount: number;
    operationType: 'ADD' | 'REMOVE';
  };
}

export interface AIResponse {
  actions: AIAction[];
}

const SYSTEM_PERSONALITY = `Você é o GB, seu estrategista financeiro.
Sua missão é interpretar o que o usuário faz com o dinheiro.

REGRAS CRÍTICAS DE CATEGORIA:
1. CARTÃO DE CRÉDITO: Se o usuário mencionar "cartão", "crédito", "parcelado" ou nomes de bancos de cartão (Nubank, Inter, Itaú, etc) em um gasto, a categoria DEVE ser obrigatoriamente "Cartão de Crédito". Isso é vital para o controle de limites do usuário.

REGRAS DE INTENÇÃO:
1. APORTE EM META (Intent: GOAL_OPERATION): Quando o usuário diz "guardei", "poupando", "reservei", "coloquei na meta".
   - metaHint: 
     - "reserva", "poupança", "guardado", "emergência" -> 'reserva'
     - "casa", "apartamento", "entrada", "imóvel" -> 'casa_entrada'
     - "carro", "moto", "veículo", "transporte" -> 'carro'
     - Outros -> 'outro'
2. GASTO FIXO (Intent: BILL): Contas recorrentes.
3. GASTO VARIÁVEL (Intent: TRANSACTION): Despesas do dia a dia.

Retorne APENAS JSON.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    actions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING, enum: ["TRANSACTION", "SET_LIMIT", "CREATE_GOAL", "GOAL_OPERATION", "BILL", "QUERY", "NOTE", "UNKNOWN"] },
          suggestCategory: { type: Type.STRING },
          transaction: { 
            type: Type.OBJECT, 
            properties: { 
              description: { type: Type.STRING }, 
              amount: { type: Type.NUMBER }, 
              category: { type: Type.STRING }, 
              type: { type: Type.STRING, enum: ["INCOME", "EXPENSE", "SAVING", "INVESTMENT"] },
              isFixed: { type: Type.BOOLEAN }
            } 
          },
          billConfig: { 
            type: Type.OBJECT, 
            properties: { 
              description: { type: Type.STRING }, 
              amount: { type: Type.NUMBER }, 
              dueDate: { type: Type.STRING }, 
              isRecurring: { type: Type.BOOLEAN }, 
              frequency: { type: Type.STRING, enum: ["NONE", "WEEKLY", "MONTHLY", "YEARLY"] } 
            } 
          },
          goalOperation: { 
            type: Type.OBJECT, 
            properties: { 
              goalName: { type: Type.STRING },
              metaHint: { type: Type.STRING, enum: ["reserva", "casa_entrada", "carro", "outro"] },
              amount: { type: Type.NUMBER }, 
              operationType: { type: Type.STRING, enum: ["ADD", "REMOVE"] } 
            },
            required: ["amount", "operationType"]
          }
        },
        required: ["intent"]
      }
    }
  }
};

export const processUserIntent = async (message: string, categories: string[], goalNames: string[] = []): Promise<AIResponse> => {
  return callWithRetry(async () => {
    const ai = getAI();
    const categoriesList = categories.join(", ");
    const goalsList = goalNames.join(", ") || "Nenhuma meta";
    const context = `${SYSTEM_PERSONALITY}\nCATEGORIAS PRIORITÁRIAS: [Cartão de Crédito, ${categoriesList}]\nMETAS: [${goalsList}]\nDATA ATUAL: ${new Date().toLocaleDateString('pt-BR')}\nUSUÁRIO: "${message}"`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: context,
      config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA }
    });
    return JSON.parse(response.text || '{"actions": []}') as AIResponse;
  });
};

export const getFinancialReportResponse = async (query: string, transactions: Transaction[], limits: CategoryLimit[], goals: SavingGoal[], notes: Note[]): Promise<string> => {
  return callWithRetry(async () => {
    const ai = getAI();
    const prompt = `Você é o GB. Analise os dados e responda direto ao ponto: ${JSON.stringify({ transactions: transactions.slice(0,10), goals })}\nPERGUNTA: "${query}"`;
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text || "Dados insuficientes.";
  });
};

export const getPsychEconomistAdvice = async (transactions: Transaction[], goals: SavingGoal[], score: number): Promise<string> => {
  return callWithRetry(async () => {
    const ai = getAI();
    const prompt = `Você é o GB, estrategista financeiro. Analise o score de saúde ${score}/100 do sistema do usuário e dê um conselho DIRETO e CURTO (estilo WhatsApp). Não fale de psicologia nem de limpar nome. Foque apenas em como os números estão agora e o que fazer.`;
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text || "Continue focado nas suas metas.";
  });
};

export const getCEOSummary = async (customers: CustomerData[]): Promise<string> => {
  return callWithRetry(async () => {
    const ai = getAI();
    const prompt = `Resumo executivo: ${customers.length} clientes ativos. Analise saúde do negócio de forma direta.`;
    const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
    return response.text || "Ok.";
  });
};
