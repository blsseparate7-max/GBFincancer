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

// Load Firebase Config
let firebaseConfig: any;
try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
} catch (e) {
  console.error("CRITICAL: Failed to load firebase-applet-config.json from", process.cwd(), e);
  // Fallback to empty to avoid immediate crash but fail later with meaningful error
  firebaseConfig = {};
}

// Initialize Client SDK
const clientApp = initializeClientApp(firebaseConfig);
const db = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

// Bypass Key for Security Rules
const AUTH_BYPASS = { auth_bypass_key: 'gbfinancer-server-2026' };

// Initialize Admin SDK 
if (!admin.apps.length) {
  admin.initializeApp({ projectId: firebaseConfig.projectId }); 
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
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: isProd ? 'production' : 'sandbox', time: new Date().toISOString() });
});

// Endpoint to create Asaas Checkout
app.post("/api/checkout/asaas", async (req, res) => {
  let { uid, email, plan, name, cpfCnpj } = req.body;

  if (!uid || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    if (cpfCnpj) cpfCnpj = cpfCnpj.replace(/\D/g, '');

    if (!cpfCnpj) {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        cpfCnpj = userData.cpfCnpj ? userData.cpfCnpj.replace(/\D/g, '') : undefined;
        if (!name) name = userData.name;
      }
    }

    if (!cpfCnpj) {
      throw new Error("CPF ou CNPJ é obrigatório para realizar o pagamento.");
    }

    const customers = await asaasFetch(`/customers?email=${email}`);
    let customerId = customers.data?.[0]?.id;

    if (!customerId) {
      const customer = await asaasFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({ name: name || email, email, cpfCnpj })
      });
      customerId = customer.id;
    }

    const sessionRef = await addDoc(collection(db, "checkoutSessions"), {
      uid, email, plan, provider: 'asaas', status: 'pending',
      createdAt: serverTimestamp(), ...AUTH_BYPASS
    });

    const subscription = await asaasFetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId, billingType: 'UNDEFINED', value: 8.70,
        nextDueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        cycle: 'MONTHLY', description: `Plano Mensal - GB Financer`,
        externalReference: sessionRef.id
      })
    });

    const payments = await asaasFetch(`/payments?subscription=${subscription.id}&limit=1`);
    const firstPayment = payments.data?.[0];

    if (!firstPayment) {
      throw new Error("Assinatura criada, mas não foi possível gerar o link de pagamento inicial.");
    }

    const checkoutUrl = firstPayment.invoiceUrl || firstPayment.bankSlipUrl || firstPayment.checkoutUrl;
    res.json({ checkoutUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
      
      await updateDoc(doc(db, "checkoutSessions", externalReference), {
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
app.post("/api/webhooks/kiwify", async (req, res) => {
  const { order_status, custom_parameters, plan, order_id } = req.body;
  const sessionId = custom_parameters?.session_id;
  if (!sessionId) return res.status(400).json({ error: "session_id missing" });

  try {
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
