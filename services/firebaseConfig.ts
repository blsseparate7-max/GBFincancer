
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableMultiTabIndexedDbPersistence, clearIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../firebase-applet-config.json";

// Inicialização segura
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);
const storage = getStorage(app);

// Habilitar Persistência (Offline) - Ajuda na estabilidade e cache
if (typeof window !== "undefined") {
  const disablePersistence = localStorage.getItem('gb_disable_persistence') === 'true';
  
  if (!disablePersistence) {
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Múltiplas abas abertas, persistência pode ser habilitada em apenas uma aba por vez (se não usar multi-tab)
        console.warn("GB: Persistência falhou (failed-precondition)");
      } else if (err.code === 'unimplemented') {
        // O navegador não suporta persistência
        console.warn("GB: Persistência não suportada pelo navegador");
      } else {
        console.error("GB: Erro ao habilitar persistência:", err);
        // Se falhar de forma crítica, marcamos para desativar na próxima carga para evitar loop de erro
        if (err.message?.includes("Indexed Database server lost")) {
          localStorage.setItem('gb_disable_persistence', 'true');
          // Tenta limpar para a próxima vez que o usuário reativar
          clearIndexedDbPersistence(db);
        }
      }
    });
  } else {
    console.warn("GB: Persistência desativada manualmente via localStorage (gb_disable_persistence)");
  }
}

export const isFirebaseConfigured = () => {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "TODO_KEYHERE";
};

export { db, auth, storage, clearIndexedDbPersistence };
