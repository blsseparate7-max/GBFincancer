
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getCategoryMappingPrompt, suggestCategory } from "./categoryService";

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
              'UPDATE_CATEGORY', 'DELETE_CATEGORY', 'MOVE_TRANSACTION_CATEGORY',
              'CREATE_DEBT', 'UPDATE_DEBT', 'DELETE_DEBT', 'REGISTER_DEBT_PAYMENT'
            ] 
          },
          payload: { 
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER, description: "VALOR TOTAL da compra. Se o usuário disser '100 em 12x', calcule o total (1200)." },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              paymentMethod: { type: Type.STRING, enum: ['PIX', 'DEBIT', 'CREDIT', 'CASH', 'TRANSFER', 'CARD'] },
              cardId: { type: Type.STRING },
              dueDay: { type: Type.NUMBER },
              name: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              remainingAmount: { type: Type.NUMBER },
              installmentAmount: { type: Type.NUMBER },
              debtId: { type: Type.STRING },
              targetAmount: { type: Type.NUMBER },
              location: { type: Type.STRING },
              goalId: { type: Type.STRING },
              targetWalletId: { type: Type.STRING, description: "ID da carteira de destino para entradas ou transferências" },
              sourceWalletId: { type: Type.STRING, description: "ID da carteira de origem para saídas ou transferências" },
              targetWalletName: { type: Type.STRING, description: "Nome da carteira de destino" },
              sourceWalletName: { type: Type.STRING, description: "Nome da carteira de origem" },
              fromWalletId: { type: Type.STRING },
              toWalletId: { type: Type.STRING },
              note: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['PAY', 'RECEIVE'] },
              id: { type: Type.STRING },
              newName: { type: Type.STRING },
              oldName: { type: Type.STRING },
              transactionId: { type: Type.STRING },
              newCategory: { type: Type.STRING },
              installments: { type: Type.NUMBER, description: "Número de parcelas (ex: 12). Se for compra parcelada, este campo é OBRIGATÓRIO." }
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

export const parseMessage = async (text: string, userName: string, context?: { user?: any, reminders?: any[], cards?: any[], wallets?: any[], categories?: any[], transactions?: any[], goals?: any[], limits?: any[], debts?: any[], spendingLimit?: number | null, userPatterns?: any[] }) => {
  try {
    const ai = getAI();
    if (!ai) return { reply: "IA Indisponível." };

    const today = new Date().toISOString().split('T')[0];
    
    // Contexto de Categorias
    const categoriesContext = context?.categories && context.categories.length > 0 ?
      `CATEGORIAS DO USUÁRIO: ${JSON.stringify(context.categories.map(c => ({ id: c.id, nome: c.name, tipo: c.type })))}` :
      'Nenhuma categoria personalizada cadastrada ainda.';

    // Contexto de Padrões Aprendidos
    const patternsContext = getCategoryMappingPrompt(context?.userPatterns || []);

    // Contexto de Metas
    const goalsContext = context?.goals && context.goals.length > 0 ?
      `METAS DE ECONOMIA: ${JSON.stringify(context.goals.map(g => ({ id: g.id, nome: g.name, alvo: g.targetAmount, atual: g.currentAmount, progresso: ((g.currentAmount / g.targetAmount) * 100).toFixed(1) + '%' })))}` :
      'Sem metas cadastradas.';

    // Contexto de Dívidas
    const debtsContext = context?.debts && context.debts.length > 0 ?
      `DÍVIDAS ATIVAS: ${JSON.stringify(context.debts.map(d => ({ id: d.id, nome: d.name, total: d.totalAmount, restante: d.remainingAmount, status: d.status })))}` :
      'Nenhuma dívida registrada.';

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

    const spendingLimitContext = context?.spendingLimit ? 
      `TETO DE GASTOS GLOBAL MENSAL: R$ ${context.spendingLimit}` : 
      'TETO DE GASTOS GLOBAL: Não definido.';

    const incomeProfileContext = context?.user?.incomeProfile ?
      `PERFIL DE RENDA (Fontes Esperadas): ${JSON.stringify(context.user.incomeProfile)}` :
      'Perfil de renda não configurado.';

    const onboardingContext = context?.user?.onboardingStatus ?
      `STATUS DO ONBOARDING: Passo ${context.user.onboardingStatus.step}, Completado: ${context.user.onboardingStatus.completed}. ${context.user.onboardingStatus.step === 3 ? 'O usuário deve confirmar se já recebeu o salário este mês. Se ele disser "Sim" ou confirmar, você DEVE gerar o evento ADD_INCOME usando os dados do PERFIL DE RENDA.' : ''}` :
      '';

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
      ${debtsContext}
      ${limitsContext}
      ${categorySummary}
      ${categoryAverages}
      ${recentTransactions}
      ${remindersContext}
      ${cardsContext}
      ${walletsContext}
      ${spendingLimitContext}
      ${incomeProfileContext}
      ${onboardingContext}

      ${patternsContext}

      REGRAS DE CATEGORIZAÇÃO:
      1. Se o usuário mencionar algo que combine com o MAPA DE PALAVRAS-CHAVE acima, use a categoria sugerida.
      2. Priorize SEMPRE as CATEGORIAS DO USUÁRIO se houver uma correspondência semântica clara.
      3. Se não houver correspondência clara, use "Outros". NUNCA retorne categoria vazia ou null.
      4. Se o usuário disser "recebi", "ganhei" ou confirmar um recebimento, a categoria deve ser "Recebimento" ou similar (Entrada) e você deve gerar um evento ADD_INCOME.
      
      REGRAS DE OURO (FONTE DA VERDADE):
      1. Você deve SEMPRE priorizar os dados acima sobre qualquer conversa anterior.
      2. Se o usuário perguntar sobre pendências, verifique os LEMBRETES onde "pago" é false.
      3. MAPEAMENTO DE CARTEIRAS: Sempre que o usuário mencionar uma carteira pelo nome (ex: 'Nubank', 'Carteira'), procure o 'id' correspondente na lista de CARTEIRAS e use-o em 'sourceWalletId' ou 'targetWalletId'.
      4. CONFIRMAÇÕES (ONBOARDING): Se o usuário confirmar um recebimento (ex: 'Sim', 'Já recebi', 'Confirmado') e estiver no Passo 3 do Onboarding, você DEVE OBRIGATORIAMENTE gerar o evento ADD_INCOME correspondente. 
         - Use o valor de 'amountExpected' das fontes do PERFIL DE RENDA como 'amount'.
         - Use o 'targetWalletName' das fontes do PERFIL DE RENDA como 'targetWalletName'.
         - Se houver múltiplas fontes, use a primeira ou a que melhor se encaixar no valor mencionado.
         - Não pergunte novamente, apenas registre.
      5. CONFIRMAÇÕES GERAIS: Se o valor ou carteira não estiverem na mensagem atual, tente inferir dos LEMBRETES (tipo RECEIVE), PERFIL DE RENDA ou CARTEIRAS disponíveis no contexto. Se o usuário confirmar algo que você acabou de perguntar, gere o evento correspondente.
      6. Se o usuário disser apenas "Sim", "Ok", "Confirmado" ou similar, e houver uma ação pendente óbvia no contexto (como um lembrete de salário no onboarding), gere o evento para essa ação. Use os campos 'targetWalletName' para entradas e 'sourceWalletName' para saídas.
      
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
      - Se o usuário disser algo como "gastei 1200 em 12x" ou "comprei 300 no cartão em 6x", você deve identificar que é uma compra parcelada.
      - O evento deve ser ADD_CARD_CHARGE.
      - O "amount" deve ser o VALOR TOTAL da compra (ex: 1200).
      - O campo "installments" deve conter o número de parcelas (ex: 12).
      - Se o usuário disser "paguei 100 em 12x", o "amount" deve ser 1200 (100 * 12).
      - NUNCA envie o valor da parcela no campo "amount". O sistema faz a divisão automaticamente.

      OBJETIVO: Analisar a mensagem e retornar um JSON com "reply" e opcionalmente uma lista de "events".
      
      ESTILO DE RESPOSTA (PREMIUM):
      - Seja extremamente curto, profissional e direto.
      - Use emojis de forma elegante e minimalista (máximo 1 por parágrafo).
      - Se o usuário pedir um resumo ("resumo", "como estou", "meu saldo"), forneça uma análise rápida e clara baseada nos dados (Total de gastos, saldo disponível e se há alertas).
      - Se o usuário perguntar sobre o teto de gastos:
        - Caso não exista: "O teto de gastos ainda não foi definido."
        - Caso exista: "Teto atual: R$ [VALOR]. Você já utilizou: R$ [VALOR_GASTO]."
      - Se o usuário registrar algo, responda apenas com uma confirmação curta (ex: 'Registrado! ✅', 'Anotado, ${userName}.').
      - Não repita informações que já estão na tela ou que foram ditas recentemente.
      - Se detectar um problema (gasto alto, saldo baixo), use um tom consultivo e discreto.
      - Máximo de 1 ou 2 frases por resposta, a menos que seja uma análise complexa solicitada.
      - Evite saudações longas ("Olá, como posso ajudar hoje?"). Vá direto ao ponto.
      
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
    
    // Injetar isQA se o contexto for de teste (Fonte da Verdade)
    const isQA = context?.user?.isQA || false;
    
    // Post-process to ensure categories are never undefined and inject isQA
    if (parsed.events) {
      parsed.events = parsed.events.map((event: any) => {
        if (event.payload) {
          // Injetar isQA
          if (isQA) event.payload.isQA = true;

          if (event.type === 'ADD_EXPENSE' || event.type === 'ADD_INCOME' || event.type === 'CREATE_REMINDER' || event.type === 'ADD_CARD_CHARGE') {
            if (!event.payload.category || event.payload.category === 'null' || event.payload.category === 'undefined') {
              event.payload.category = suggestCategory(event.payload.description || text, context?.userPatterns || []);
            }
          }
        }
        return event;
      });
    }

    console.log("GB Debug - IA Respondeu:", parsed);
    return parsed;
  } catch (e) {
    console.error("GB Debug - Erro na IA:", e);
    return { reply: "Entendi. Pode me dar os detalhes para eu registrar? (Houve um erro técnico na análise)" };
  }
};
