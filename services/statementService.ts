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
          amount: { type: Type.NUMBER, description: "Valor numérico positivo para entrada e saída. O sinal será definido pelo campo 'type'." },
          type: { type: Type.STRING, enum: ['EXPENSE', 'INCOME'], description: "EXPENSE para saídas/pagamentos, INCOME para entradas/recebimentos" },
          category: { type: Type.STRING, description: "Categoria sugerida (ex: Alimentação, Transporte, Lazer, Saúde, Moradia, Salário, Outros)" },
          isCardCharge: { type: Type.BOOLEAN, description: "Verdadeiro se a transação parecer ser uma compra no cartão de crédito" },
          paymentMethod: { type: Type.STRING, description: "Sugestão de método (PIX, CARTAO, DINHEIRO, TRANSFERENCIA, DEBITO)" }
        },
        required: ["date", "description", "amount", "type"]
      }
    },
    summary: {
      type: Type.OBJECT,
      properties: {
        totalIncome: { type: Type.NUMBER },
        totalExpense: { type: Type.NUMBER },
        period: { type: Type.STRING },
        bankName: { type: Type.STRING }
      }
    }
  },
  required: ["transactions"]
};

export const parseStatementFile = async (file: File) => {
  try {
    const ai = getAI();
    if (!ai) throw new Error("IA Indisponível");

    const isTextFile = ['text/csv', 'text/plain', 'application/x-ofx', 'application/ofx'].includes(file.type) || 
                       file.name.endsWith('.csv') || file.name.endsWith('.ofx') || file.name.endsWith('.txt');

    let contentPart: any;

    if (isTextFile) {
      const text = await file.text();
      contentPart = { text: `CONTEÚDO DO ARQUIVO:\n${text}` };
    } else {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });
      
      contentPart = {
        inlineData: {
          mimeType: file.type || 'application/pdf', // Fallback para PDF se mimeType vier vazio
          data: base64Data
        }
      };
    }

    const prompt = `Você é um especialista em análise de extratos bancários e faturas de cartão.
    Analise o arquivo/imagem enviado e extraia TODAS as transações financeiras individuais.
    
    REGRAS DE INTERPRETAÇÃO:
    1. Identifique a data (tente inferir o ano se não estiver explícito, use 2026 se for futuro próximo ou 2025 se for passado).
    2. Identifique a descrição clara do estabelecimento ou tipo de transação.
    3. Identifique o valor. Se o valor estiver negativo ou em uma coluna de 'débito/saída', marque como EXPENSE. Se estiver positivo ou em 'crédito/entrada', marque como INCOME.
    4. Se não houver sinal claro, use o contexto da descrição (ex: "PAGTO", "COMPRA", "DEB" costumam ser EXPENSE. "RECEB", "CRED", "PIX RECEBIDO" costumam ser INCOME).
    5. Classifique automaticamente em categorias: Alimentação, Transporte, Lazer, Saúde, Moradia, Educação, Salário, Investimentos ou Outros.
    6. Identifique se é uma compra de cartão de crédito (isCardCharge). Compras parceladas devem ser tratadas como o valor da parcela que aparece no extrato.
    7. Ignore linhas de saldo, juros de saldo (a menos que seja uma transação), ou informações de rodapé.
    
    Retorne os dados EXATAMENTE no formato JSON solicitado.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview', // Usando Pro para maior precisão em extração de dados complexos
      contents: [
        {
          parts: [
            { text: prompt },
            contentPart
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
