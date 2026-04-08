import { collection, getDocs, doc, setDoc, serverTimestamp, query, where, limit, increment, updateDoc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

/**
 * Inteligência de Categorização GBFinancer
 * Mapeamento de palavras-chave para categorias sugeridas.
 */

export interface CategoryPattern {
  id: string;
  keyword: string;
  category: string;
  count: number;
  lastUsed: any;
}

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': ['mercado', 'supermercado', 'atacado', 'compra do mês', 'padaria', 'açougue', 'hortifruti', 'ifood', 'lanche', 'hamburguer', 'restaurante', 'almoço', 'jantar', 'pizza', 'pastel', 'delivery', 'comida'],
  'Transporte': ['uber', '99', 'taxi', 'gasolina', 'combustível', 'posto', 'estacionamento', 'pedágio', 'ônibus'],
  'Saúde': ['farmácia', 'remédio', 'consulta', 'médico', 'exame', 'dentista', 'hospital'],
  'Casa': ['água', 'luz', 'energia', 'internet', 'telefone', 'aluguel', 'condomínio', 'gás'],
  'Educação': ['curso', 'faculdade', 'escola', 'material escolar', 'aula', 'mensalidade'],
  'Lazer': ['cinema', 'netflix', 'spotify', 'passeio', 'viagem', 'parque', 'diversão', 'show'],
  'Beleza': ['roupa', 'tênis', 'salão', 'manicure', 'barbearia', 'perfume', 'maquiagem'],
  'Pets': ['petshop', 'ração', 'veterinário', 'cachorro', 'gato'],
  'Salário': ['salário', 'comissão', 'pix recebido', 'pagamento recebido', 'venda', 'freelance', 'extra']
};

/**
 * Garante que o usuário possua as categorias básicas.
 */
export const ensureDefaultCategories = async (uid: string) => {
  if (!uid) return;
  
  // Proteção contra recriação automática durante ou logo após reset
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    if (userData.resetInProgress || userData.status === 'fresh_start') {
      console.log("GB: ensureDefaultCategories abortado devido a reset em andamento ou fresh_start");
      return;
    }
  }

  const userCatsRef = collection(db, "users", uid, "categories");
  const snap = await getDocs(userCatsRef);
  
  if (snap.empty) {
    console.log("GB: Criando categorias padrão para o usuário...");
    const defaults = [
      { name: 'Alimentação', icon: 'Utensils', color: '#FF5722', type: 'EXPENSE' },
      { name: 'Transporte', icon: 'Car', color: '#2196F3', type: 'EXPENSE' },
      { name: 'Saúde', icon: 'HeartPulse', color: '#E91E63', type: 'EXPENSE' },
      { name: 'Casa', icon: 'Home', color: '#795548', type: 'EXPENSE' },
      { name: 'Lazer', icon: 'Gamepad2', color: '#9C27B0', type: 'EXPENSE' },
      { name: 'Salário', icon: 'Banknote', color: '#4CAF50', type: 'INCOME' },
      { name: 'Outros', icon: 'Tag', color: '#607D8B', type: 'EXPENSE' }
    ];
    
    for (const cat of defaults) {
      const id = cat.name.toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(userCatsRef, id), {
        ...cat,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }
};

/**
 * Sugere uma categoria com base no texto fornecido e histórico do usuário.
 * @param text Texto da transação ou mensagem do usuário
 * @param userPatterns Padrões aprendidos do usuário
 * @returns Categoria sugerida ou 'Outros'
 */
export const suggestCategory = (text: string, userPatterns: CategoryPattern[] = []): string => {
  if (!text) return 'Outros';
  
  const lowerText = text.toLowerCase().trim();
  
  // 1. Prioridade: Histórico do Usuário (Match exato ou parcial forte)
  const historyMatch = userPatterns
    .filter(p => lowerText.includes(p.keyword.toLowerCase()))
    .sort((a, b) => b.count - a.count || b.keyword.length - a.keyword.length)[0];
    
  if (historyMatch) {
    console.log(`GB: Sugestão baseada no histórico: ${historyMatch.category} (keyword: ${historyMatch.keyword})`);
    return historyMatch.category;
  }
  
  // 2. Segunda Prioridade: Mapa de Palavras-Chave Global
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
      return category;
    }
  }
  
  return 'Outros';
};

/**
 * Aprende um novo padrão de categorização baseado na ação do usuário.
 */
export const learnCategoryPattern = async (uid: string, description: string, category: string) => {
  if (!uid || !description || !category || category === 'Outros') return;
  
  const keyword = description.toLowerCase().trim();
  if (keyword.length < 3) return; // Evita keywords muito curtas e genéricas

  const patternId = btoa(keyword).replace(/=/g, ''); // ID determinístico baseado na keyword
  const patternRef = doc(db, "users", uid, "categoryPatterns", patternId);
  
  try {
    const snap = await getDoc(patternRef);
    if (snap.exists()) {
      await updateDoc(patternRef, {
        count: increment(1),
        category: category, // Atualiza se o usuário mudou de ideia sobre essa keyword
        lastUsed: serverTimestamp()
      });
    } else {
      await setDoc(patternRef, {
        keyword,
        category,
        count: 1,
        lastUsed: serverTimestamp()
      });
    }
    console.log(`GB: Padrão aprendido: "${keyword}" -> ${category}`);
  } catch (e) {
    console.error("Erro ao aprender padrão de categoria:", e);
  }
};

/**
 * Retorna uma lista formatada para o prompt da IA.
 */
export const getCategoryMappingPrompt = (userPatterns: CategoryPattern[] = []): string => {
  let prompt = "DIRETRIZES DE CATEGORIZAÇÃO (MAPA DE PALAVRAS-CHAVE):\n";
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    prompt += `- ${category}: [${keywords.join(', ')}]\n`;
  }
  
  if (userPatterns.length > 0) {
    prompt += "\nHISTÓRICO DE APRENDIZADO DO USUÁRIO (ALTA PRIORIDADE):\n";
    // Pegamos os 20 padrões mais frequentes para não estourar o contexto
    const topPatterns = [...userPatterns].sort((a, b) => b.count - a.count).slice(0, 20);
    topPatterns.forEach(p => {
      prompt += `- "${p.keyword}" -> ${p.category} (usado ${p.count} vezes)\n`;
    });
  }
  
  return prompt;
};
