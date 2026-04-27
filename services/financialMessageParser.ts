
/**
 * GBFinancer - Parser de Linguagem Natural para Lançamentos Financeiros
 * Focado em robustez para o português brasileiro e formatos flexíveis de valores.
 */

export interface ParsedFinancialMessage {
  type: 'expense' | 'income' | 'transfer' | 'pay_card' | 'unknown';
  amount: number | null;
  description: string;
  categoryHint: string;
  confidence: number;
  fromWallet?: string;
  toWallet?: string;
  paymentMethod?: 'CARD' | 'PIX' | 'CASH';
  installments?: number;
  missingFields: string[];
}

/**
 * Normaliza a mensagem para facilitar o parsing
 */
const normalizeMessage = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(\d+)\s+reais/g, '$1')
    .replace(/(\d+)\s+conto/g, '$1')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ""); // Remove acentos
};

/**
 * Detecta o método de pagamento
 */
const detectPaymentMethod = (text: string): 'CARD' | 'PIX' | 'CASH' | undefined => {
  const cardKeywords = ['cartao', 'credito', 'nubank', 'inter', 'itau', 'mastercard', 'visa', 'parcelado', 'vezes', 'parcela', 'x'];
  const pixKeywords = ['pix', 'transferencia', 'transferi'];
  const cashKeywords = ['dinheiro', 'especie', 'notas'];

  const lower = text.toLowerCase();
  if (cardKeywords.some(k => lower.includes(k))) return 'CARD';
  if (pixKeywords.some(k => lower.includes(k))) return 'PIX';
  if (cashKeywords.some(k => lower.includes(k))) return 'CASH';
  return undefined;
};

/**
 * Extrai o número de parcelas
 */
const extractInstallments = (text: string): number | undefined => {
  const match = text.match(/(\d+)\s*(?:x|vezes|parcelas)/i) || text.match(/(?:em|de)\s*(\d+)\s*(?:x|vezes|parcelas)/i);
  if (match) return parseInt(match[1]);
  return undefined;
};

/**
 * Extrai o valor numérico de uma string, tratando formatos brasileiros e internacionais
 */
const extractAmount = (text: string): number | null => {
  // Regex que busca um numeral com possíveis prefixos/sufixos monetários
  // Captura formatos como: 355,06 | R$ 355,06 | 355,06$ | 1.200,50 | 1200.50 | 30
  const amountRegex = /(?:r\$|brl|\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}|\d+)\s*(?:r\$|brl|\$)?/i;
  const match = text.match(amountRegex);

  if (!match) return null;

  let rawValue = match[1];
  
  // Normalização fina para converter em Float válido
  if (rawValue.includes(',') && rawValue.includes('.')) {
    // Se o ponto vier antes da vírgula, tratamos como padrão BR (1.000,00)
    if (rawValue.indexOf('.') < rawValue.indexOf(',')) {
      rawValue = rawValue.replace(/\./g, '').replace(',', '.');
    } else {
      // Senão tratamos como padrão US (1,000.00)
      rawValue = rawValue.replace(/,/g, '');
    }
  } 
  else if (rawValue.includes(',')) {
    // Apenas vírgula: trata como decimal (355,06 -> 355.06)
    rawValue = rawValue.replace(',', '.');
  }
  else if (/\d\.\d{3}(?!\d)/.test(rawValue)) {
    // Apenas ponto seguido de exatamente 3 dígitos: provável separador de milhar (1.000 -> 1000)
    // Nota: Isso pode ser ambíguo se o usuário usar ponto para decimal com 3 casas,
    // mas no contexto financeiro brasileiro, 1.000 costuma ser mil
    rawValue = rawValue.replace(/\./g, '');
  }

  const amount = parseFloat(rawValue);
  return isNaN(amount) ? null : amount;
};

/**
 * Identifica a intenção da mensagem
 */
const detectIntent = (text: string): 'expense' | 'income' | 'transfer' | 'pay_card' | 'unknown' => {
  const expenseKeywords = ['gastei', 'paguei', 'saiu', 'saíram', 'comprei', 'compra', 'pagamento', 'despesa', 'gasto', 'débito', 'saida'];
  const incomeKeywords = ['recebi', 'ganhei', 'entrou', 'caiu', 'recebimento', 'salário', 'renda', 'pix recebido', 'crédito', 'entrada'];
  const transferKeywords = ['transferi', 'transferência', 'passei', 'mandei para', 'transferir', 'pix para'];

  const lower = text.toLowerCase();
  
  if (transferKeywords.some(k => lower.includes(k))) return 'transfer';
  if (incomeKeywords.some(k => lower.includes(k))) return 'income';
  
  // Detecção específica de pagamento de fatura
  if ((lower.includes('fatura') || lower.includes('pagamento do cartão')) && (lower.includes('paguei') || lower.includes('pagamento') || lower.includes('quitei'))) {
    return 'expense'; 
  }

  if (expenseKeywords.some(k => lower.includes(k))) return 'expense';

  // REGRA DE OURO: Se tem valor mas não tem intenção clara, assumimos GASTO se tiver algum texto (descrição)
  const amount = extractAmount(lower);
  if (amount && amount > 0) {
    return 'expense';
  }

  return 'unknown';
};

/**
 * Extrai a descrição/categoria da mensagem
 */
const extractDescription = (text: string, rawAmountStr: string | null): string => {
  let desc = text;

  if (rawAmountStr) {
    // Escapa o valor cru para usar no regex de remoção
    const escapedAmount = rawAmountStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Regex que remove o numeral e possíveis símbolos monetários grudados ou próximos
    const amountPattern = new RegExp(`(?:r\\$|brl|\\$)?\\s*${escapedAmount}\\s*(?:r\\$|brl|\\$)?`, 'gi');
    desc = desc.replace(amountPattern, '');
  }

  // Lista de comandos e conectivos para limpar a descrição
  const commands = [
    'gastei', 'paguei', 'saiu', 'saíram', 'comprei', 'compra', 'com', 'de', 'no', 'na', 'o', 'a', 'um', 'uma',
    'recebi', 'ganhei', 'entrou', 'caiu', 'recebimento', 'recebi', 'transferi', 'passei', 'da carteira', 'para a', 'para', 'pro', 'pra'
  ];
  
  commands.forEach(cmd => {
    const reg = new RegExp(`\\b${cmd}\\b`, 'gi');
    desc = desc.replace(reg, '');
  });

  // Limpa caracteres de separação e pontuação residual
  desc = desc.replace(/[,\.;\/]/g, ' ');

  return desc.replace(/\s+/g, ' ').trim();
};

/**
 * Divide uma mensagem em múltiplas partes se houver separadores
 */
const splitMessage = (text: string): string[] => {
  // Ignora centavos (ex: 30,50) para não quebrar a mensagem no separador de milhar/decimal
  const parts = text.split(/\s*[,;e/]\s*(?!\d{2}\b)/i)
    .filter(p => p.trim().length > 0);
  
  return parts.length > 0 ? parts : [text];
};

/**
 * Parser principal de mensagens financeiras
 */
export const parseFinancialMessage = (message: string): ParsedFinancialMessage => {
  const normalized = normalizeMessage(message);
  const amount = extractAmount(normalized);
  const intent = detectIntent(normalized);
  const paymentMethod = detectPaymentMethod(normalized);
  const installments = extractInstallments(normalized);
  
  // Mesma regex do extractAmount para identificar o que remover da descrição
  const amountRegex = /(?:r\$|brl|\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}|\d+)\s*(?:r\$|brl|\$)?/i;
  const amountMatch = normalized.match(amountRegex);
  const rawAmountStr = amountMatch ? amountMatch[1] : null;
  
  const description = extractDescription(normalized, rawAmountStr);
  const missingFields: string[] = [];

  if (!amount) missingFields.push('valor');
  if (intent === 'unknown') missingFields.push('tipo de transação');
  
  let finalMethod = paymentMethod || (installments ? 'CARD' : undefined);
  let finalType: any = intent;

  const isInvoicePayment = normalized.includes('fatura') || normalized.includes('pagamento do cartão') || normalized.includes('paguei o cartão');
  if (intent === 'expense' && isInvoicePayment) {
     finalType = 'pay_card';
     finalMethod = 'PIX'; 
  }

  if (!description || description.length < 2) {
    if (intent !== 'income') missingFields.push('descrição');
  }

  let fromWallet, toWallet;
  if (intent === 'transfer') {
    const transferParts = normalized.split(/\b(?:para|pro|pra|para a|para o)\b/i);
    if (transferParts.length > 1) {
      const fromPart = transferParts[0].split(/\b(?:da|do|de|da carteira|do banco)\b/i);
      fromWallet = fromPart.length > 1 ? fromPart[1].trim().split(' ')[0] : undefined;
      toWallet = transferParts[1].trim().split(' ')[0];
    }
  }

  let confidence = 0;
  if (amount !== null) confidence += 0.4;
  if (intent !== 'unknown') confidence += 0.3;
  if (description && description.length > 1) confidence += 0.2;
  if (finalMethod === 'CARD') confidence += 0.1;
  if (missingFields.length > 0) confidence -= (missingFields.length * 0.1);

  return {
    type: finalType === 'unknown' && amount ? 'expense' : finalType,
    amount,
    description: description || (intent === 'income' ? 'Recebimento' : 'Gasto'),
    categoryHint: description,
    confidence: Math.max(0, Math.min(1, confidence)),
    fromWallet,
    toWallet,
    paymentMethod: finalMethod,
    installments,
    missingFields
  };
};

/**
 * Parse de múltiplas mensagens em uma única string
 */
export const parseMultipleTransactions = (message: string): ParsedFinancialMessage[] => {
  const parts = splitMessage(message);
  if (parts.length <= 1) return [parseFinancialMessage(message)];

  return parts.map(part => parseFinancialMessage(part)).filter(p => p.amount !== null);
};
