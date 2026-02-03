
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the Google GenAI SDK with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FINANCE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: { 
      type: Type.STRING, 
      description: "A intenção do usuário: 'TRANSACTION', 'QUERY' ou 'OTHER'" 
    },
    transaction: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING },
        amount: { type: Type.NUMBER },
        category: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['INCOME', 'EXPENSE', 'SAVING'] }
      }
    },
    reply: { type: Type.STRING, description: "Uma resposta curta e amigável em português para o usuário" }
  },
  required: ["intent", "reply"]
};

export const processFinanceMessage = async (text: string) => {
  // Use ai.models.generateContent to query GenAI with the model name and prompt.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Você é o GB, um assistente financeiro no WhatsApp. 
    Analise a mensagem do usuário e extraia dados se for um registro de gasto ou ganho.
    Categorias comuns: Alimentação, Transporte, Lazer, Saúde, Salário, Casa.
    Mensagem: "${text}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: FINANCE_SCHEMA
    }
  });

  // Extract text using the .text property of GenerateContentResponse.
  return JSON.parse(response.text || "{}");
};

export const getFinancialAdvice = async (data: any) => {
  // Use ai.models.generateContent to query GenAI with the model name and prompt.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Com base nestes dados: ${JSON.stringify(data)}, dê um conselho financeiro curto e motivador de 1 frase para o usuário.`
  });
  // Extract text using the .text property of GenerateContentResponse.
  return response.text;
};

// Added getCEOSummary to provide high-level insights for the admin dashboard
export const getCEOSummary = async (customers: any[]) => {
  const summaryData = customers.map(c => ({
    userName: c.userName,
    status: c.subscriptionStatus,
    plan: c.plan,
    activityCount: c.transactions?.length || 0
  }));

  // Use ai.models.generateContent with a pro model for complex reasoning tasks.
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analise a base de clientes do GBFinancer e forneça um insight estratégico curto em português (1 frase) sobre retenção e receita: ${JSON.stringify(summaryData)}`,
  });

  // Extract text using the .text property of GenerateContentResponse.
  return response.text || "Sem insights estratégicos no momento.";
};
