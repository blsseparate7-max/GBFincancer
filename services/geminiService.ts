
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, SavingGoal } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AIResponse {
  intent: 'TRANSACTION' | 'SET_LIMIT' | 'CREATE_GOAL' | 'UNKNOWN';
  transaction?: Partial<Transaction>;
  limitConfig?: { category: string; amount: number };
  goalConfig?: { name: string; targetAmount: number; monthlySaving: number };
}

/**
 * Processes user natural language input (text or voice-transcribed) to determine intent.
 */
export const processUserIntent = async (message: string): Promise<AIResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise a intenção do usuário: "${message}".
      
      Regras de Negócio:
      1. TRANSACTION: Registrar gasto, ganho ou investimento (ex: "gastei 20", "recebi 1000", "guardei 50").
      2. SET_LIMIT: Definir teto de gastos por categoria (ex: "limite de 200 em comida").
      3. CREATE_GOAL: Criar uma nova meta de economia (ex: "criar meta de viagem de 5000 guardando 200 por mes").
      
      Extraia os dados técnicos com precisão.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING, enum: ["TRANSACTION", "SET_LIMIT", "CREATE_GOAL", "UNKNOWN"] },
            transaction: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["INCOME", "EXPENSE", "SAVING"] }
              }
            },
            limitConfig: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                amount: { type: Type.NUMBER }
              }
            },
            goalConfig: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                targetAmount: { type: Type.NUMBER },
                monthlySaving: { type: Type.NUMBER }
              }
            }
          },
          required: ["intent"]
        }
      }
    });

    return JSON.parse(response.text || "{}") as AIResponse;
  } catch (error) {
    console.error("Erro na IA:", error);
    return { intent: 'UNKNOWN' };
  }
};

export const getGoalAdvice = async (goal: SavingGoal): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analise esta meta: ${goal.name}, Alvo: R$ ${goal.targetAmount}, Aporte: R$ ${goal.monthlySaving}/mês. 
      Dê uma "cotação" de esforço e um conselho realista curto (max 120 char).`,
    });
    return response.text || "Foco total na meta!";
  } catch {
    return "Mantenha a consistência.";
  }
};

export const getFinancialAdvice = async (transactions: Transaction[]): Promise<string> => {
  try {
    const context = transactions.slice(0, 10).map(t => `${t.description}: R$${t.amount}`).join(", ");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base em: ${context}. Dê um conselho financeiro cirúrgico de 1 frase.`,
    });
    return response.text || "Continue monitorando seus gastos.";
  } catch {
    return "Mantenha o controle do seu orçamento.";
  }
};

export const getBudgetWarningMessage = async (total: number, limit: number, category: string | null, isGlobal: boolean): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Alerta: R$ ${total} gastos de um limite de R$ ${limit}. Gere uma notificação curta e impactante.`,
    });
    return response.text || "Limite atingido!";
  } catch {
    return "Atenção: Limite ultrapassado!";
  }
};
