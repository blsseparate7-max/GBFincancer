import { 
  Firestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp, 
  getDoc,
  updateDoc,
  deleteField
} from "firebase/firestore";
import { signOut, Auth } from "firebase/auth";

/**
 * Realiza um Reset Financeiro completo nos dados de um usuário.
 * Apaga subcoleções financeiras e reinicia o status, preservando dados de conta/billing.
 */
export const resetUserFinancialData = async (db: Firestore, auth: Auth, userId: string) => {
  if (!db || !userId) throw new Error("Parâmetros inválidos para resetUserFinancialData");

  console.log(`GB: [RESET] Iniciando reset financeiro para o usuário ${userId}...`);

  const userRef = doc(db, "users", userId);

  try {
    // 1. Ativar flag de proteção
    await updateDoc(userRef, { resetInProgress: true });

    // 2. Buscar e preservar dados críticos (trial, plano, assinatura, billing)
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("Usuário não encontrado no Firestore");
    
    const data = userSnap.data();
    
    // 3. Lista de subcoleções que devem ser limpas
    const subcollections = [
      "transactions",
      "reminders",
      "wallets",
      "goals",
      "creditCards",
      "cards", 
      "invoices",
      "categories",
      "chat_messages",
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

    // 4. Deletar subcoleções manualmente
    for (const subName of subcollections) {
      const subRef = collection(userRef, subName);
      const snapshot = await getDocs(subRef);
      
      if (snapshot.empty) continue;

      console.log(`GB: [RESET] Limpando subcoleção ${subName} (${snapshot.size} documentos)...`);

      let batch = writeBatch(db);
      let count = 0;

      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;

        if (count === 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }
    }

    // 5. Atualizar documento principal
    // Limpamos campos financeiros e de onboarding, preservando billing/trial
    await updateDoc(userRef, {
      // Campos a limpar
      incomeProfile: deleteField(),
      spendingLimit: deleteField(),
      suggestedGoals: deleteField(),
      defaultReceivingWallet: deleteField(),
      onboardingSeen: deleteField(),
      onboardingStatus: deleteField(),
      lgpdAccepted: deleteField(),
      lgpdAcceptedAt: deleteField(),
      lgpdVersion: deleteField(),
      currency: deleteField(),
      financial_summary: deleteField(), // Caso seja um campo
      
      // Novos status
      status: "fresh_start",
      resetAt: serverTimestamp(),
      onboardingCompleted: false,
      resetInProgress: false 
    });

    // 6. Limpeza de Frontend
    localStorage.clear();
    sessionStorage.clear();
    
    console.log(`GB: [RESET] Reset financeiro concluído com sucesso para ${userId}.`);

    // 7. Logout
    await signOut(auth);
    
    return true;
  } catch (error) {
    console.error("GB: [RESET] Erro durante o reset financeiro:", error);
    // Tenta desativar a flag em caso de erro
    try {
      await updateDoc(userRef, { resetInProgress: false });
    } catch (e) {}
    throw error;
  }
};

/**
 * @deprecated Use resetUserFinancialData instead
 */
export const resetUserData = resetUserFinancialData as any;
