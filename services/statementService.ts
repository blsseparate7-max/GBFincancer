import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

const STATEMENT_PARSER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
          description: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          type: { type: Type.STRING, enum: ['EXPENSE', 'INCOME'] },
          category: { type: Type.STRING, description: "Categoria sugerida (ex: Alimentação, Transporte, etc)" },
          isCardCharge: { type: Type.BOOLEAN, description: "Se parece ser uma compra no cartão de crédito" }
        },
        required: ["date", "description", "amount", "type"]
      }
    },
    summary: {
      type: Type.OBJECT,
      properties: {
        totalIncome: { type: Type.NUMBER },
        totalExpense: { type: Type.NUMBER },
        period: { type: Type.STRING }
      }
    }
  },
  required: ["transactions"]
};

export const parseStatementFile = async (file: File) => {
  try {
    const ai = getAI();
    if (!ai) throw new Error("IA Indisponível");

    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });

    const prompt = `Analise este extrato bancário (arquivo ou imagem) e extraia todas as transações financeiras.
    
    REGRAS:
    1. Identifique a data, descrição e valor de cada transação.
    2. Classifique como EXPENSE (saída/débito) ou INCOME (entrada/crédito).
    3. Sugira uma categoria apropriada com base na descrição (ex: Uber -> Transporte, iFood -> Alimentação).
    4. Identifique se a transação parece ser uma compra no cartão de crédito (isCardCharge).
    5. Ignore saldos parciais, apenas extraia as movimentações.
    6. Retorne os dados no formato JSON estruturado.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: STATEMENT_PARSER_SCHEMA
      }
    });

    if (!response.text) throw new Error("Falha na extração de dados");

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Erro ao processar extrato:", error);
    throw error;
  }
};
