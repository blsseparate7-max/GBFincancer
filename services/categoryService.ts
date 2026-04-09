import { collection, getDocs, doc, setDoc, serverTimestamp, query, where, limit, increment, updateDoc, getDoc, writeBatch, deleteDoc } from "firebase/firestore";
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
  'Alimentação': ['ifood', 'lanche', 'hamburguer', 'restaurante', 'almoço', 'jantar', 'pizza', 'pastel', 'delivery', 'comida', 'café', 'padaria', 'sorvete', 'bar', 'churrasco'],
  'Mercado': ['mercado', 'supermercado', 'atacado', 'compra do mês', 'açougue', 'hortifruti', 'feira', 'carrefour', 'pão de açúcar', 'extra', 'assai', 'atacadão'],
  'Transporte': ['uber', '99', 'taxi', 'estacionamento', 'pedágio', 'ônibus', 'metrô', 'trem', 'passagem', 'viagem'],
  'Combustível': ['gasolina', 'combustível', 'posto', 'etanol', 'diesel', 'gnv', 'shell', 'ipiranga', 'petrobras'],
  'Moradia': ['aluguel', 'condomínio', 'iptu', 'reforma', 'móveis', 'decoração', 'limpeza', 'faxina'],
  'Contas': ['água', 'luz', 'energia', 'internet', 'telefone', 'gás', 'celular', 'vivo', 'claro', 'tim', 'oi', 'sky'],
  'Saúde': ['consulta', 'médico', 'exame', 'dentista', 'hospital', 'plano de saúde', 'psicólogo', 'terapia'],
  'Farmácia': ['farmácia', 'remédio', 'drogaria', 'pague menos', 'raia', 'drogasil'],
  'Lazer': ['cinema', 'passeio', 'viagem', 'parque', 'diversão', 'show', 'teatro', 'museu', 'festa', 'clube', 'praia'],
  'Educação': ['curso', 'faculdade', 'escola', 'material escolar', 'aula', 'mensalidade', 'livro', 'idioma', 'inglês'],
  'Assinaturas': ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'youtube', 'assinatura', 'mensalidade app', 'icloud', 'google one'],
  'Compras': ['roupa', 'tênis', 'sapato', 'eletrônico', 'celular', 'presente', 'shopee', 'mercado livre', 'shein', 'amazon', 'magalu', 'casas bahia'],
  'Investimentos': ['corretora', 'bolsa', 'ações', 'fii', 'tesouro', 'investimento', 'aporte', 'nuinvest', 'xp', 'btg'],
  'Pets': ['petshop', 'ração', 'veterinário', 'cachorro', 'gato', 'banho e tosa'],
  'Salário': ['salário', 'comissão', 'pagamento recebido', 'venda', 'freelance', 'extra', 'pro-labore', 'bonus', 'plr'],
  'Recebimento': ['pix recebido', 'transferência recebida', 'reembolso', 'ajuste', 'depósito']
};

/**
 * Gera um ID determinístico para a categoria baseado no nome.
 * Remove acentos, espaços e caracteres especiais para garantir unicidade.
 */
export const getCategoryId = (name: string): string => {
  if (!name) return 'outros';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '_') // Substitui não-alfanuméricos por _
    .replace(/_+/g, '_') // Remove múltiplos underscores
    .replace(/^_+|_+$/g, ''); // Remove underscores no início/fim
};

/**
 * Garante que o usuário possua as categorias básicas.
 */
export const ensureDefaultCategories = async (uid: string) => {
  if (!uid) return;
  
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    if (userData.resetInProgress || userData.status === 'fresh_start') {
      return;
    }
  }

  const userCatsRef = collection(db, "users", uid, "categories");
  
  const defaults = [
    { name: 'Alimentação', icon: 'Utensils', color: '#FF9800', type: 'EXPENSE' },
    { name: 'Mercado', icon: 'ShoppingCart', color: '#4CAF50', type: 'EXPENSE' },
    { name: 'Transporte', icon: 'Car', color: '#2196F3', type: 'EXPENSE' },
    { name: 'Combustível', icon: 'Fuel', color: '#F44336', type: 'EXPENSE' },
    { name: 'Moradia', icon: 'Home', color: '#795548', type: 'EXPENSE' },
    { name: 'Contas', icon: 'FileText', color: '#607D8B', type: 'EXPENSE' },
    { name: 'Saúde', icon: 'HeartPulse', color: '#E91E63', type: 'EXPENSE' },
    { name: 'Farmácia', icon: 'Pill', color: '#FF4081', type: 'EXPENSE' },
    { name: 'Lazer', icon: 'Gamepad2', color: '#9C27B0', type: 'EXPENSE' },
    { name: 'Educação', icon: 'GraduationCap', color: '#3F51B5', type: 'EXPENSE' },
    { name: 'Assinaturas', icon: 'Repeat', color: '#00BCD4', type: 'EXPENSE' },
    { name: 'Compras', icon: 'ShoppingBag', color: '#FF5722', type: 'EXPENSE' },
    { name: 'Investimentos', icon: 'TrendingUp', color: '#009688', type: 'EXPENSE' },
    { name: 'Salário', icon: 'Banknote', color: '#4CAF50', type: 'INCOME' },
    { name: 'Recebimento', icon: 'ArrowDownCircle', color: '#8BC34A', type: 'INCOME' },
    { name: 'Outros', icon: 'Tag', color: '#9E9E9E', type: 'EXPENSE' }
  ];
  
  for (const cat of defaults) {
    const id = getCategoryId(cat.name);
    const catRef = doc(userCatsRef, id);
    const catSnap = await getDoc(catRef);
    
    if (!catSnap.exists()) {
      await setDoc(catRef, {
        ...cat,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }
};

/**
 * Rotina de Deduplicação de Categorias.
 * Identifica categorias com nomes similares (normalizados para o mesmo ID)
 * e unifica as transações sob uma única categoria.
 */
export const deduplicateCategories = async (uid: string) => {
  if (!uid) return { success: false, error: "UID missing" };
  
  try {
    const userRef = doc(db, "users", uid);
    const catsSnap = await getDocs(collection(userRef, "categories"));
    const categories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    
    const groups: Record<string, any[]> = {};
    categories.forEach(cat => {
      const normalizedId = getCategoryId(cat.name);
      if (!groups[normalizedId]) groups[normalizedId] = [];
      groups[normalizedId].push(cat);
    });
    
    let mergedCount = 0;
    let transUpdated = 0;

    for (const normalizedId in groups) {
      const group = groups[normalizedId];
      if (group.length > 1) {
        // Escolhe a categoria "vencedora" (a que tem ID determinístico ou a mais antiga)
        const winner = group.find(c => c.id === normalizedId) || group[0];
        const losers = group.filter(c => c.id !== winner.id);
        
        for (const loser of losers) {
          // 1. Atualiza transações do perdedor para o vencedor
          const transQ = query(collection(userRef, "transactions"), where("category", "==", loser.name));
          const transSnap = await getDocs(transQ);
          
          if (!transSnap.empty) {
            const batch = writeBatch(db);
            transSnap.docs.forEach(d => {
              batch.update(d.ref, {
                category: winner.name,
                categoryName: winner.name,
                categoryId: winner.id
              });
              transUpdated++;
            });
            await batch.commit();
          }
          
          // 2. Deleta a categoria duplicada
          await deleteDoc(doc(userRef, "categories", loser.id));
          mergedCount++;
        }
      }
    }
    
    return { success: true, mergedCount, transUpdated };
  } catch (error) {
    console.error("GB: Erro na deduplicação de categorias:", error);
    return { success: false, error };
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
