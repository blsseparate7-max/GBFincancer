import express from "express";
import path from "path";
import fs from "fs";
import admin from "firebase-admin";
import { initializeApp as initializeClientApp } from "firebase/app";
import { 
  getFirestore as getClientFirestore, 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  updateDoc 
} from "firebase/firestore";

import { fileURLToPath } from "url";
import { dirname } from "path";

// Support both ESM and CJS environments for path resolution
let _dirname = "";
try {
  _dirname = dirname(fileURLToPath(import.meta.url));
} catch (e) {
  // Fallback for non-ESM environments if any
  _dirname = __dirname;
}

// Load Firebase Config
let firebaseConfig: any;
try {
  const possiblePaths = [
    path.resolve(process.cwd(), "firebase-applet-config.json"),
    path.resolve(process.cwd(), "api", "firebase-applet-config.json"),
    path.resolve(process.cwd(), "..", "firebase-applet-config.json"),
    path.resolve(_dirname, "firebase-applet-config.json"),
    path.resolve(_dirname, "..", "firebase-applet-config.json"),
    "/var/task/firebase-applet-config.json", // Common Vercel path
    "/var/task/api/firebase-applet-config.json"
  ];

  console.log("[DEBUG] Current working directory:", process.cwd());
  console.log("[DEBUG] _dirname identified as:", _dirname);

  let foundPath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      foundPath = p;
      break;
    }
  }

  if (foundPath) {
    console.log(`[DEBUG] Found firebase config at: ${foundPath}`);
    firebaseConfig = JSON.parse(fs.readFileSync(foundPath, "utf8"));
  } else {
    console.warn("[DEBUG] Firebase config NOT FOUND in any common locations.");
    // Log checked paths for remote debugging
    console.log("[DEBUG] Checked paths:", JSON.stringify(possiblePaths));
    firebaseConfig = {};
  }
} catch (e: any) {
  console.error("CRITICAL: Failed to load firebase-applet-config.json", e.message);
  firebaseConfig = {};
}

// Bypass Key for Security Rules
const AUTH_BYPASS = { auth_bypass_key: 'gbfinancer-server-2026' };

// Initialize Admin SDK 
if (!admin.apps.length && firebaseConfig?.projectId) {
  admin.initializeApp({ projectId: firebaseConfig.projectId }); 
}

let _db: any = null;
function getDb() {
  if (_db) return _db;
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    throw new Error("Configuração do Firebase não encontrada no servidor (API).");
  }
  const clientApp = initializeClientApp(firebaseConfig);
  _db = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
  return _db;
}

const app = express();
app.use(express.json());

// Asaas Config
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || '';
const isProd = process.env.VITE_ASAAS_ENVIRONMENT === 'production' || ASAAS_API_KEY.includes('prod');
const ASAAS_BASE_URL = isProd ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';

// Helper to call Asaas API
async function asaasFetch(endpoint: string, options: any = {}) {
  const response = await fetch(`${ASAAS_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[ASAAS ERROR] ${endpoint}:`, JSON.stringify(errorData));
    throw new Error(errorData.errors?.[0]?.description || 'Erro na API do Asaas');
  }

  return response.json();
}

// Health check and diagnostic
const healthHandler = (req: any, res: any) => {
  res.json({ 
    status: "ok", 
    environment: isProd ? 'production' : 'sandbox', 
    time: new Date().toISOString(),
    node_version: process.version,
    firebase_config_loaded: !!(firebaseConfig && firebaseConfig.apiKey),
    firebase_project_id: firebaseConfig?.projectId || "not_found",
    cwd: process.cwd(),
    env_keys_found: {
      asaas: !!ASAAS_API_KEY,
      webhook: !!ASAAS_WEBHOOK_TOKEN,
      firebase: !!firebaseConfig?.projectId
    }
  });
};

app.get("/api/health", healthHandler);
app.get("/health", healthHandler);

// Endpoint to create Asaas Checkout (handled with and without /api prefix)
const checkoutAsaasHandler = async (req: any, res: any) => {
  let { uid, email, plan, name, cpfCnpj } = req.body;
  console.log(`[ASAAS] Checkout requested for ${email} (${plan})`);

  if (!uid || !email) {
    console.error("[ASAAS] Error: Missing uid or email");
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const db = getDb();
    if (cpfCnpj) cpfCnpj = cpfCnpj.replace(/\D/g, '');

    if (!cpfCnpj) {
      console.log(`[ASAAS] Fetching CPF from Firestore for ${uid}`);
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        cpfCnpj = userData.cpfCnpj ? userData.cpfCnpj.replace(/\D/g, '') : undefined;
        if (!name) name = userData.name;
      }
    }

    if (!cpfCnpj) {
      console.error(`[ASAAS] Error: CPF/CNPJ missing for user ${uid}`);
      return res.status(400).json({ error: "O CPF ou CNPJ é obrigatório para cadastrar o cliente no Asaas. Por favor, atualize seu perfil ou informe o CPF." });
    }

    console.log(`[ASAAS] Identifying customer for ${email}`);
    const encodedEmail = encodeURIComponent(email);
    const customers = await asaasFetch(`/customers?email=${encodedEmail}`);
    let customerId = customers.data?.[0]?.id;

    if (!customerId) {
      console.log(`[ASAAS] Creating new customer for ${email}`);
      const customer = await asaasFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({ name: name || email, email, cpfCnpj })
      });
      customerId = customer.id;
    }

    console.log(`[ASAAS] Creating session for ${uid}`);
    const sessionRef = await addDoc(collection(db, "checkoutSessions"), {
      uid, email, plan, provider: 'asaas', status: 'pending',
      createdAt: serverTimestamp(), ...AUTH_BYPASS
    });

    console.log(`[ASAAS] Creating subscription for customer ${customerId}`);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1);
    
    const subscription = await asaasFetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId, 
        billingType: 'UNDEFINED', 
        value: 8.70,
        nextDueDate: nextDate.toISOString().split('T')[0],
        cycle: 'MONTHLY', 
        description: `Plano Mensal - GB Financer`,
        externalReference: sessionRef.id
      })
    });

    console.log(`[ASAAS] Fetching payment for subscription ${subscription.id}`);
    const payments = await asaasFetch(`/payments?subscription=${subscription.id}&limit=1`);
    const firstPayment = payments.data?.[0];

    if (!firstPayment) {
      throw new Error("Assinatura criada com sucesso, mas não conseguimos localizar o pagamento imediato. Verifique seu e-mail.");
    }

    const checkoutUrl = firstPayment.invoiceUrl || firstPayment.bankSlipUrl || firstPayment.checkoutUrl;
    console.log(`[ASAAS] Success! Checkout URL: ${checkoutUrl}`);
    res.json({ checkoutUrl });
  } catch (error: any) {
    console.error("[ASAAS ERROR]:", error.message);
    res.status(500).json({ error: error.message });
  }
};

app.post("/api/checkout/asaas", checkoutAsaasHandler);
app.post("/checkout/asaas", checkoutAsaasHandler);

// Asaas Webhook
app.post("/api/webhooks/asaas", async (req, res) => {
  const token = req.headers['asaas-access-token'];
  if (ASAAS_WEBHOOK_TOKEN && token !== ASAAS_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { event, payment, subscription } = req.body;
  const externalReference = payment?.externalReference || subscription?.externalReference;

  if (!externalReference) return res.status(200).json({ message: "Ignored" });

  try {
    const db = getDb();
    const sessionDoc = await getDoc(doc(db, "checkoutSessions", externalReference));
    if (!sessionDoc.exists()) return res.status(404).json({ error: "Session not found" });

    const { uid, plan } = sessionDoc.data()!;
    const userRef = doc(db, "users", uid);

    const isApproved = event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED' || event === 'SUBSCRIPTION_CREATED' || event.includes('PAYMENT_CONFIRMED');
    const isFailed = event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_DELETED';

    if (isApproved) {
      const days = plan === 'anual' ? 365 : 30;
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + days);

      await updateDoc(userRef, {
        subscriptionStatus: 'active',
        subscriptionEndsAt: endsAt.toISOString(),
        plan: plan || 'mensal',
        paymentProvider: 'asaas',
        lastOrderId: payment?.id || subscription?.id,
        updatedAt: serverTimestamp(),
        ...AUTH_BYPASS
      });
      
      await updateDoc(doc(getDb(), "checkoutSessions", externalReference), {
        status: 'completed', updatedAt: serverTimestamp(), ...AUTH_BYPASS
      });
    } else if (isFailed) {
      await updateDoc(userRef, {
        subscriptionStatus: 'inactive', updatedAt: serverTimestamp(), ...AUTH_BYPASS
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal error" });
  }
});

// Kiwify Webhook
app.post("/api/webhooks/kiwify", async (req: any, res: any) => {
  const { order_status, custom_parameters, plan, order_id } = req.body;
  const sessionId = custom_parameters?.session_id;
  if (!sessionId) return res.status(400).json({ error: "session_id missing" });

  try {
    const db = getDb();
    const sessionRef = doc(db, "checkoutSessions", sessionId);
    const sessionDoc = await getDoc(sessionRef);
    if (!sessionDoc.exists()) return res.status(404).json({ error: "Session not found" });

    const { uid } = sessionDoc.data()!;
    const userRef = doc(db, "users", uid);

    if (order_status === "paid") {
      const days = plan?.name?.toLowerCase().includes("anual") ? 365 : 30;
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + days);

      await updateDoc(userRef, {
        subscriptionStatus: "active",
        subscriptionEndsAt: endsAt.toISOString(),
        plan: plan?.name?.toLowerCase().includes("anual") ? "anual" : "mensal",
        paymentProvider: "kiwify",
        lastOrderId: order_id,
        updatedAt: serverTimestamp(),
        ...AUTH_BYPASS
      });
      
      await updateDoc(sessionRef, { status: "completed", orderId: order_id, completedAt: serverTimestamp(), ...AUTH_BYPASS });
    } else if (["refunded", "canceled", "chargedback"].includes(order_status)) {
      await updateDoc(userRef, { subscriptionStatus: "inactive", updatedAt: serverTimestamp(), ...AUTH_BYPASS });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal error" });
  }
});

export default app;
