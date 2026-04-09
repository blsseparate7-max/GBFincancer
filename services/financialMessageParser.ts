
/**
 * GBFinancer - Parser de Linguagem Natural para Lançamentos Financeiros
 * Focado em robustez para o português brasileiro e formatos flexíveis de valores.
 */

export interface ParsedFinancialMessage {
  type: 'expense' | 'income' | 'transfer' | 'unknown';
  amount: number | null;
  description: string;
  categoryHint: string;
  confidence: number;
  fromWallet?: string;
  toWallet?: string;
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
    .replace(/r\$/g, 'R$')
    .replace(/\$/g, '$');
};

/**
 * Extrai o valor numérico de uma string, tratando formatos brasileiros
 */
const extractAmount = (text: string): number | null => {
  const amountRegex = /(?:R\$|\$)?\s*(\d+(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d+)?)\s*(?:\$|R\$)?/;
  const match = text.match(amountRegex);

  if (!match) return null;

  let rawValue = match[1];
  
  if (rawValue.includes('.') && rawValue.includes(',')) {
    rawValue = rawValue.replace(/\./g, '').replace(',', '.');
  } 
  else if (rawValue.includes(',')) {
    rawValue = rawValue.replace(',', '.');
  }
  else if (/\d\.\d{3}(?!\d)/.test(rawValue)) {
    rawValue = rawValue.replace(/\./g, '');
  }

  const amount = parseFloat(rawValue);
  return isNaN(amount) ? null : amount;
};

/**
 * Identifica a intenção da mensagem
 */
const detectIntent = (text: string): 'expense' | 'income' | 'transfer' | 'unknown' => {
  const expenseKeywords = ['gastei', 'paguei', 'saiu', 'saíram', 'comprei', 'compra', 'pagamento', 'despesa', 'gasto', 'débito'];
  const incomeKeywords = ['recebi', 'ganhei', 'entrou', 'caiu', 'recebimento', 'salário', 'renda', 'pix recebido', 'crédito'];
  const transferKeywords = ['transferi', 'transferência', 'passei', 'mandei para', 'transferir', 'pix para'];

  const lower = text.toLowerCase();
  if (transferKeywords.some(k => lower.includes(k))) return 'transfer';
  if (incomeKeywords.some(k => lower.includes(k))) return 'income';
  if (expenseKeywords.some(k => lower.includes(k))) return 'expense';

  return 'unknown';
};

/**
 * Extrai a descrição/categoria da mensagem
 */
const extractDescription = (text: string, amountStr: string | null): string => {
  let desc = text;

  if (amountStr) {
    const escapedAmount = amountStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const amountPattern = new RegExp(`(?:R\\$|\\$)?\\s*${escapedAmount}\\s*(?:\\$|R\\$)?`, 'i');
    desc = desc.replace(amountPattern, '');
  }

  const commands = [
    'gastei', 'paguei', 'saiu', 'saíram', 'comprei', 'com', 'de', 'no', 'na', 'o', 'a',
    'recebi', 'ganhei', 'entrou', 'caiu', 'transferi', 'passei', 'da carteira', 'para a', 'para', 'pro', 'pra'
  ];
  
  commands.forEach(cmd => {
    const reg = new RegExp(`\\b${cmd}\\b`, 'gi');
    desc = desc.replace(reg, '');
  });

  return desc.replace(/\s+/g, ' ').trim();
};

/**
 * Parser principal de mensagens financeiras
 */
export const parseFinancialMessage = (message: string): ParsedFinancialMessage => {
  const normalized = normalizeMessage(message);
  const amount = extractAmount(normalized);
  const intent = detectIntent(normalized);
  
  const amountMatch = normalized.match(/(?:R\$|\$)?\s*(\d+(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d+)?)\s*(?:\$|R\$)?/);
  const rawAmountStr = amountMatch ? amountMatch[1] : null;
  
  const description = extractDescription(normalized, rawAmountStr);
  const missingFields: string[] = [];

  if (!amount) missingFields.push('valor');
  if (intent === 'unknown') missingFields.push('tipo de transação');
  if (!description || description.length < 2) {
    if (intent !== 'income') missingFields.push('descrição');
  }

  // Lógica de Transferência
  let fromWallet, toWallet;
  if (intent === 'transfer') {
    const transferParts = normalized.split(/\b(?:para|pro|pra|para a|para o)\b/i);
    if (transferParts.length > 1) {
      const fromPart = transferParts[0].split(/\b(?:da|do|de|da carteira|do banco)\b/i);
      fromWallet = fromPart.length > 1 ? fromPart[1].trim().split(' ')[0] : undefined;
      toWallet = transferParts[1].trim().split(' ')[0];
    }
    if (!fromWallet) missingFields.push('carteira de origem');
    if (!toWallet) missingFields.push('carteira de destino');
  }

  let confidence = 0;
  if (amount !== null) confidence += 0.5;
  if (intent !== 'unknown') confidence += 0.3;
  if (description.length > 1) confidence += 0.2;
  if (missingFields.length > 0) confidence -= (missingFields.length * 0.1);

  return {
    type: intent,
    amount,
    description: description || (intent === 'income' ? 'Recebimento' : 'Gasto'),
    categoryHint: description,
    confidence: Math.max(0, Math.min(1, confidence)),
    fromWallet,
    toWallet,
    missingFields
  };
};
