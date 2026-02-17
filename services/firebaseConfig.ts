
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCfxd5LUVv1DFF08KFH5Mrhj1re8H2ADTA",
  authDomain: "gbfinancer-3491b.firebaseapp.com",
  projectId: "gbfinancer-3491b",
  storageBucket: "gbfinancer-3491b.firebasestorage.app",
  messagingSenderId: "417257308876",
  appId: "1:417257308876:web:1e0a2a58f4a3b556507869"
};

// Inicialização segura
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export const isFirebaseConfigured = () => {
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY";
};

export { db, auth, storage };
