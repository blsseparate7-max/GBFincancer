import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', icon: 'Utensils', color: '#f43f5e', type: 'EXPENSE' },
  { name: 'Mercado', icon: 'ShoppingCart', color: '#f43f5e', type: 'EXPENSE' },
  { name: 'Restaurante', icon: 'Coffee', color: '#f43f5e', type: 'EXPENSE' },
  { name: 'Lanche', icon: 'Pizza', color: '#f43f5e', type: 'EXPENSE' },
  { name: 'Delivery', icon: 'Bike', color: '#f43f5e', type: 'EXPENSE' },
  { name: 'Transporte', icon: 'Car', color: '#3b82f6', type: 'EXPENSE' },
  { name: 'Combustível', icon: 'Fuel', color: '#3b82f6', type: 'EXPENSE' },
  { name: 'Uber / Taxi', icon: 'Smartphone', color: '#3b82f6', type: 'EXPENSE' },
  { name: 'Saúde', icon: 'HeartPulse', color: '#ef4444', type: 'EXPENSE' },
  { name: 'Farmácia', icon: 'Pill', color: '#ef4444', type: 'EXPENSE' },
  { name: 'Academia', icon: 'Dumbbell', color: '#ef4444', type: 'EXPENSE' },
  { name: 'Educação', icon: 'GraduationCap', color: '#8b5cf6', type: 'EXPENSE' },
  { name: 'Faculdade', icon: 'School', color: '#8b5cf6', type: 'EXPENSE' },
  { name: 'Cursos', icon: 'BookOpen', color: '#8b5cf6', type: 'EXPENSE' },
  { name: 'Lazer', icon: 'Palmtree', color: '#f59e0b', type: 'EXPENSE' },
  { name: 'Cinema / Streaming', icon: 'Tv', color: '#f59e0b', type: 'EXPENSE' },
  { name: 'Viagem', icon: 'Plane', color: '#f59e0b', type: 'EXPENSE' },
  { name: 'Casa', icon: 'Home', color: '#6366f1', type: 'EXPENSE' },
  { name: 'Água', icon: 'Droplets', color: '#6366f1', type: 'EXPENSE' },
  { name: 'Luz', icon: 'Zap', color: '#6366f1', type: 'EXPENSE' },
  { name: 'Internet', icon: 'Wifi', color: '#6366f1', type: 'EXPENSE' },
  { name: 'Telefone', icon: 'Phone', color: '#6366f1', type: 'EXPENSE' },
  { name: 'Aluguel', icon: 'Key', color: '#6366f1', type: 'EXPENSE' },
  { name: 'Cartão de crédito', icon: 'CreditCard', color: '#64748b', type: 'EXPENSE' },
  { name: 'Assinaturas', icon: 'Repeat', color: '#64748b', type: 'EXPENSE' },
  { name: 'Pets', icon: 'Dog', color: '#ec4899', type: 'EXPENSE' },
  { name: 'Roupas', icon: 'Shirt', color: '#ec4899', type: 'EXPENSE' },
  { name: 'Beleza', icon: 'Sparkles', color: '#ec4899', type: 'EXPENSE' },
  { name: 'Investimentos', icon: 'TrendingUp', color: '#10b981', type: 'EXPENSE' },
  { name: 'Salário', icon: 'DollarSign', color: '#00A884', type: 'INCOME' },
  { name: 'Comissão', icon: 'Percent', color: '#00A884', type: 'INCOME' },
  { name: 'Freelance', icon: 'Briefcase', color: '#00A884', type: 'INCOME' },
  { name: 'Pix recebido', icon: 'Smartphone', color: '#00A884', type: 'INCOME' },
  { name: 'Presentes', icon: 'Gift', color: '#00A884', type: 'INCOME' },
  { name: 'Outros', icon: 'Tag', color: '#94a3b8', type: 'EXPENSE' },
];

export const ensureDefaultCategories = async (uid: string) => {
  if (!uid) return;
  
  try {
    const userRef = doc(db, "users", uid);
    const catRef = collection(userRef, "categories");
    const snap = await getDocs(catRef);
    
    const existingNames = new Set(snap.docs.map(d => d.data().name));
    const batch = writeBatch(db);
    let added = false;

    for (const cat of DEFAULT_CATEGORIES) {
      if (!existingNames.has(cat.name)) {
        const newCatRef = doc(catRef);
        batch.set(newCatRef, {
          ...cat,
          id: newCatRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        added = true;
      }
    }

    if (added) {
      await batch.commit();
      console.log(`GB: Categorias padrão sincronizadas para o usuário ${uid}.`);
    }
  } catch (error) {
    console.error("GB: Erro ao garantir categorias padrão:", error);
  }
};
