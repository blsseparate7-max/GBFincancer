
import { GoogleGenAI, Type } from "@google/genai";
import { getCategoryMappingPrompt, suggestCategory } from "./categoryService";
import { parseFinancialMessage } from "./financialMessageParser";

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
              'CREATE_DEBT', 'UPDATE_DEBT', 'DELETE_DEBT', 'REGISTER_DEBT_PAYMENT',
              'ESCALATE_SUPPORT'
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
              installments: { type: Type.NUMBER, description: "Número de parcelas (ex: 12). Se for compra parcelada, este campo é OBRIGATÓRIO." },
              reason: { type: Type.STRING, description: "Motivo do escalonamento para suporte" },
              module: { type: Type.STRING, enum: ['chat', 'extrato', 'dashboard', 'categorias', 'carteiras', 'outros'], description: "Módulo onde o problema ocorreu" },
              issueType: { type: Type.STRING, enum: ['bug', 'duvida', 'erro', 'sugestao'], description: "Tipo do problema relatado" }
            }
          }
        },
        required: ["type", "payload"]
      }
    },
    reply: { type: Type.STRING },
    intent: { 
      type: Type.STRING, 
      enum: [
        'expense_summary', 'income_summary', 'balance_summary', 
        'category_summary', 'wallet_summary', 'statement_query', 
        'ranking_query', 'limit_query', 'reminder_query', 
        'comparison_query', 'insight_query', 'goal_query', 
        'credit_card_query', 'transaction_registration', 'support_escalation', 'other'
      ] 
    }
  },
  required: ["reply"]
};

export const parseMessage = async (text: string, userName: string, context?: { user?: any, reminders?: any[], cards?: any[], wallets?: any[], categories?: any[], transactions?: any[], goals?: any[], limits?: any[], debts?: any[], spendingLimit?: number | null, userPatterns?: any[] }) => {
  try {
    const ai = getAI();
    if (!ai) return { reply: "IA Indisponível." };

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTime = now.toLocaleTimeString('pt-BR');
    
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

    // Contexto de Transações (Fonte da Verdade para Consultas)
    // Passamos uma lista maior para permitir consultas de períodos (hoje, semana, mês, etc)
    const transactionsContext = context?.transactions && context.transactions.length > 0 ? 
      `LISTA DE TRANSAÇÕES (Últimas ${context.transactions.length}): ${JSON.stringify(context.transactions.map(t => ({ 
        id: t.id, 
        desc: t.description, 
        valor: t.amount, 
        tipo: t.type, 
        cat: t.category, 
        data: t.date,
        carteira: t.walletName || t.sourceWalletName || t.targetWalletName
      })))}` :
      'Sem transações registradas.';

    // Resumo por Categoria (Mês Atual) - Mantido para facilitar a vida da IA
    const categorySummary = context?.transactions ? 
      (() => {
        const summary: Record<string, { total: number, count: number }> = {};
        let totalMonth = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
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
      `CARTEIRAS (Saldos Atuais): ${JSON.stringify(context.wallets.map(w => ({ id: w.id, nome: w.name, saldo: w.balance })))}` :
      'Sem carteiras.';

    const spendingLimitContext = context?.spendingLimit ? 
      `TETO DE GASTOS GLOBAL MENSAL: R$ ${context.spendingLimit}` : 
      'TETO DE GASTOS GLOBAL: Não definido.';

    const incomeProfileContext = context?.user?.incomeProfile ?
      `PERFIL DE RENDA (Fontes Esperadas): ${JSON.stringify(context.user.incomeProfile)}` :
      'Perfil de renda não configurado.';

    const onboardingContext = context?.user?.onboardingStatus ?
      `STATUS DO ONBOARDING: Passo ${context.user.onboardingStatus.step}, Completado: ${context.user.onboardingStatus.completed}. ${context.user.onboardingStatus.step === 3 ? 'O usuário deve confirmar se já recebeu o salário este mês. Se ele disser "Sim" ou confirmar explicitamente o recebimento, você DEVE gerar o evento ADD_INCOME usando os dados do PERFIL DE RENDA. Caso contrário, apenas converse e aguarde a confirmação.' : ''}` :
      '';

    // Parser Determinístico (Dica para a IA)
    const parserHint = parseFinancialMessage(text);
    const parserHintContext = parserHint.confidence > 0.4 ? 
      `DICA DO SISTEMA (CONFIÁVEL): Esta mensagem parece ser um(a) ${parserHint.type.toUpperCase()} de valor R$ ${parserHint.amount} com descrição "${parserHint.description}". ${parserHint.fromWallet ? 'Origem: ' + parserHint.fromWallet : ''} ${parserHint.toWallet ? 'Destino: ' + parserHint.toWallet : ''}. ${parserHint.missingFields.length > 0 ? 'CAMPOS FALTANTES: ' + parserHint.missingFields.join(', ') : ''}` : 
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

    // Timeout de 15 segundos para evitar travamento eterno
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT_AI")), 15000)
    );

    console.log("[chat] parser start");
    const responsePromise = ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Você é o GB, mentor financeiro premium de ${userName}. Hoje é ${today} e agora são ${currentTime}.
      
      ${categoriesContext}
      ${goalsContext}
      ${debtsContext}
      ${limitsContext}
      ${categorySummary}
      ${categoryAverages}
      ${transactionsContext}
      ${remindersContext}
      ${cardsContext}
      ${walletsContext}
      ${spendingLimitContext}
      ${incomeProfileContext}
      ${onboardingContext}
      ${parserHintContext}

      ${patternsContext}

      REGRAS DE CATEGORIZAÇÃO:
      1. Se o usuário mencionar algo que combine com o MAPA DE PALAVRAS-CHAVE acima, use a categoria sugerida.
      2. Priorize SEMPRE as CATEGORIAS DO USUÁRIO se houver uma correspondência semântica clara.
      3. Se não houver correspondência clara, use "Outros". NUNCA retorne categoria vazia ou null.
      4. Se o usuário disser "recebi", "ganhei" ou confirmar um recebimento, a categoria deve ser "Recebimento" ou similar (Entrada) e você deve gerar um evento ADD_INCOME.
      
      MOTOR DE CONSULTAS FINANCEIRAS (OBRIGATÓRIO):
      Você deve atuar como um motor de busca sobre os dados reais acima.
      1. GASTOS: Calcule somas de 'valor' onde 'tipo' é 'EXPENSE' para o período solicitado (hoje, ontem, semana, mês, ano).
      2. ENTRADAS: Calcule somas de 'valor' onde 'tipo' é 'INCOME' para o período solicitado.
      3. SALDO: O saldo atual é a soma de todos os 'saldo' na lista de CARTEIRAS.
      4. CATEGORIAS: Identifique em qual categoria o usuário mais gastou somando os valores por 'cat'.
      5. LIMITES: Compare os gastos reais com os LIMITES DE GASTOS e o TETO GLOBAL.
      6. LEMBRETES: Verifique os LEMBRETES para saber o que vence hoje ou o que está pendente (pago: false).
      7. COMPARAÇÃO: Compare somas de períodos (ex: este mês vs mês passado).
      8. NUNCA INVENTE DADOS. Se não houver dados para o período, diga que não encontrou registros.
      
      REGRAS DE OURO (FONTE DA VERDADE):
      1. Você deve SEMPRE priorizar os dados acima sobre qualquer conversa anterior.
      2. Se houver uma "DICA DO SISTEMA" acima, considere-a como prova de que a mensagem É um comando financeiro. Se a confiança for alta, você DEVE gerar o evento correspondente, mesmo que precise adivinhar campos secundários usando o contexto (ex: se o usuário diz "gastei 50 no mercado", adivinhe que a categoria é mercado ou 'Alimentação' baseado no seu conhecimento e padrões do usuário).
      3. NUNCA diga "Não entendi" para mensagens que contenham claramente valores monetários ou intenções financeiras listadas na "DICA DO SISTEMA". Se faltar informação, gere o evento com o que tem e peça o restante no 'reply'.
      4. Se o usuário perguntar sobre pendências, verifique os LEMBRETES onde "pago" é false.
      5. MAPEAMENTO DE CARTEIRAS: Sempre que o usuário mencionar uma carteira pelo nome (ex: 'Nubank', 'Carteira'), procure o 'id' correspondente na lista de CARTEIRAS e use-o em 'sourceWalletId' ou 'targetWalletId'.
      6. CONFIRMAÇÕES (ONBOARDING): Se o usuário confirmar um recebimento (ex: 'Sim', 'Já recebi', 'Confirmado') e estiver no Passo 3 do Onboarding, você DEVE OBRIGATORIAMENTE gerar o evento ADD_INCOME correspondente. 
         - Use o valor de 'amountExpected' das fontes do PERFIL DE RENDA como 'amount'.
         - Use o 'targetWalletName' das fontes do PERFIL DE RENDA como 'targetWalletName'.
      7. FLUXO DE CONFIRMAÇÃO (OBRIGATÓRIO): 
         - Para QUALQUER gasto, entrada ou transferência, você DEVE gerar o evento correspondente no JSON.
         - Sua resposta ('reply') NÃO deve dizer que já registrou. Ela deve ser uma pergunta de confirmação ou um aviso de que os dados estão prontos para conferência.
         - Exemplo: "Certo! Preparei o registro de R$ [valor] para [descrição]. Pode confirmar os detalhes abaixo? 👇"
         - NUNCA diga "Registrado!" se você está enviando um evento para confirmação na UI. Diga "Preparei o registro" ou "Confirme os detalhes".
      8. SUPORTE E ESCALONAMENTO (OBRIGATÓRIO):
         - Você é a primeira camada de suporte. Se o usuário tiver dúvidas sobre como usar o app, responda e oriente.
         - Se o usuário relatar um BUG, ERRO técnico, ou se você não conseguir resolver o problema após 1 tentativa, você DEVE gerar o evento ESCALATE_SUPPORT.
         - No payload de ESCALATE_SUPPORT, inclua:
           - 'reason': Breve descrição do problema.
           - 'module': O módulo afetado (chat, extrato, dashboard, etc).
           - 'issueType': bug, duvida, erro ou sugestao.
         - Sua resposta ('reply') deve ser: "Esse caso precisa de ajuda humana. Clique abaixo para abrir o suporte."
      
      INTELIGÊNCIA FINANCEIRA (UPGRADES):
      1. DETECÇÃO DE GASTOS SUSPEITOS:
      - Se o usuário registrar um gasto (ADD_EXPENSE ou ADD_CARD_CHARGE) que seja muito maior que a média da categoria (veja MÉDIAS DE GASTO POR CATEGORIA), inclua um aviso no "reply".
      - Se detectar gasto duplicado (mesmo valor, categoria e descrição no mesmo dia), avise.
      2. ALERTA DE RISCO:
      - Se os gastos do mês (RESUMO GASTOS MÊS ATUAL) estiverem próximos de 80% da renda (se houver lembretes de RECEIVE), alerte.
      - Se o saldo total (CARTEIRAS) estiver próximo de zero, alerte.
      3. TRANSFERÊNCIAS:
      - Se o usuário disser "transfere 100 do Nubank para a Carteira", gere o evento TRANSFER_WALLET.
      - Use 'sourceWalletName' para a origem e 'targetWalletName' para o destino.
      - O valor deve ser positivo.
      4. PREVISÃO:
      - Se o usuário perguntar "como vou terminar o mês?", use os dados para estimar se o saldo será positivo ou negativo.
      4. PARCELAMENTO (CARTÃO DE CRÉDITO):
      - Se o usuário disser algo como "gastei 1200 em 12x" ou "comprei 300 no cartão em 6x", você deve identificar que é uma compra parcelada.
      - O evento deve ser ADD_CARD_CHARGE.
      - O "amount" deve ser o VALOR TOTAL da compra (ex: 1200).
      - O campo "installments" deve conter o número de parcelas (ex: 12).
      - Se o usuário disser "paguei 100 em 12x", o "amount" deve ser 1200 (100 * 12).
      - NUNCA envie o valor da parcela no campo "amount". O sistema faz a divisão automaticamente.

      OBJETIVO: Analisar a mensagem e retornar um JSON com "reply", "intent" e opcionalmente uma lista de "events".
      
      IDENTIFICAÇÃO DE INTENT:
      - Use 'transaction_registration' para quando o usuário quer registrar algo.
      - Use os intents específicos de consulta (expense_summary, balance_summary, etc) para perguntas.
      - Use 'other' para conversas gerais.
      
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
        responseSchema: FINANCE_PARSER_SCHEMA
      }
    });

    const response: any = await Promise.race([responsePromise, timeoutPromise]);

    if (!response.text) {
      throw new Error("Resposta da IA vazia");
    }

    const parsed = JSON.parse(response.text);
    console.log("[chat] parser end", parsed);
    
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
