
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCfxd5LUVv1DFF08KFH5Mrhj1re8H2ADTA",
  authDomain: "gbfinancer-3491b.firebaseapp.com",
  projectId: "gbfinancer-3491b",
  storageBucket: "gbfinancer-3491b.firebasestorage.app",
  messagingSenderId: "417257308876",
  appId: "1:417257308876:web:1e0a2a58f4a3b556507869"
};

export const isFirebaseConfigured = () => {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
};

let db: Firestore | null = null;
let app: FirebaseApp | null = null;

try {
  if (isFirebaseConfigured()) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("🔥 Firebase: Conectado e Firestore inicializado com sucesso.");
  }
} catch (error) {
  console.warn("⚠️ Firebase/Firestore não pôde ser inicializado. O App operará em modo offline/cache local.");
}

export { db };