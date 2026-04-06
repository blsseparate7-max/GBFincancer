import { 
  Firestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp, 
  setDoc,
  query,
  limit
} from "firebase/firestore";

/**
 * Realiza um Hard Reset completo nos dados de um usuário.
 * Apaga todas as subcoleções e reinicia o documento principal.
 */
export const resetUserData = async (db: Firestore, userId: string) => {
  if (!db || !userId) throw new Error("Parâmetros inválidos para resetUserData");

  console.log(`GB: Iniciando Hard Reset para o usuário ${userId}...`);

  // Lista de subcoleções conhecidas que devem ser limpas
  const subcollections = [
    "transactions",
    "goals",
    "cards",
    "invoices",
    "reminders",
    "categories",
    "wallets",
    "messages",
    "financial_summary",
    "onboarding",
    "score",
    "calendar",
    "debts",
    "limits",
    "categoryPatterns",
    "notifications"
  ];

  const userRef = doc(db, "users", userId);

  try {
    // 1. Limpar subcoleções
    for (const subName of subcollections) {
      const subRef = collection(userRef, subName);
      const snapshot = await getDocs(subRef);
      
      if (snapshot.empty) continue;

      console.log(`GB: Limpando subcoleção ${subName} (${snapshot.size} documentos)...`);

      // Firestore batch tem limite de 500 operações
      let batch = writeBatch(db);
      let count = 0;

      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;

        if (count === 450) { // Margem de segurança
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }
    }

    // 2. Resetar o documento principal do usuário
    // Mantemos o UID e campos de identificação básicos se necessário, 
    // mas o pedido é recriar conforme o esquema solicitado.
    
    // Primeiro pegamos os dados atuais para manter o que for essencial (como email/nome se quiser, 
    // mas o prompt diz "recriar o documento principal" com campos específicos)
    // No entanto, para não quebrar o Auth/Session, geralmente mantemos userId/email/name.
    // Mas vou seguir a instrução de reset total.
    
    const userSnap = await getDocs(query(collection(db, "users"), limit(1))); // Apenas para garantir que temos acesso
    
    await setDoc(userRef, {
      createdAt: serverTimestamp(),
      resetAt: serverTimestamp(),
      status: "fresh_start",
      onboardingSeen: false,
      lgpdAccepted: false,
      onboardingStatus: {
        completed: false,
        currentStep: "start",
        pendingAction: null
      }
    });

    // 3. Limpar cache local (importante para consistência)
    localStorage.removeItem(`gb_vault_${userId}`);
    localStorage.removeItem(`gb_onboarding_${userId}`);

    console.log(`GB: Hard Reset concluído com sucesso para ${userId}.`);
    return true;
  } catch (error) {
    console.error("GB: Erro durante o Hard Reset:", error);
    throw error;
  }
};
