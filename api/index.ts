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
  updateDoc,
  deleteDoc
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

    // Save subscription and customer ID directly to checkout sessions in Firestore
    await updateDoc(sessionRef, {
      subscriptionId: subscription.id,
      customerId: customerId,
      updatedAt: serverTimestamp(),
      ...AUTH_BYPASS
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
const asaasWebhookHandler = async (req: any, res: any) => {
  try {
    const token = req.headers['asaas-access-token'] || req.headers['Asaas-Access-Token'];
    console.log(`[ASAAS WEBHOOK] Request received at ${new Date().toISOString()}`);
    console.log(`[ASAAS WEBHOOK] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[ASAAS WEBHOOK] Body: ${JSON.stringify(req.body)}`);

    if (ASAAS_WEBHOOK_TOKEN && token !== ASAAS_WEBHOOK_TOKEN) {
      console.error(`[ASAAS WEBHOOK] Unauthorized - Token mismatch. Received: ${token}, Expected: ${ASAAS_WEBHOOK_TOKEN}`);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { event, payment, subscription, billing } = req.body;
    
    if (!event) {
      console.log("[ASAAS WEBHOOK] No event found in body. Ignored.");
      return res.status(200).json({ received: true, message: "No event found" });
    }

    console.log(`[ASAAS WEBHOOK] Event: ${event}`);

    // External reference can be on payment, subscription or billing level
    let externalReference = payment?.externalReference || 
                            subscription?.externalReference || 
                            billing?.externalReference || 
                            req.body.externalReference;
    
    // Webhook payload sometimes lacks externalReference directly (common for recurring sub payments).
    // In that case, fetch the subscription details from Asaas API to find its externalReference.
    const subscriptionId = payment?.subscription || subscription?.id || billing?.subscription;
    if (!externalReference && subscriptionId) {
      console.log(`[ASAAS WEBHOOK] No externalReference found directly. Querying Asaas API for subscription ${subscriptionId}...`);
      try {
        const subDetails = await asaasFetch(`/subscriptions/${subscriptionId}`);
        externalReference = subDetails.externalReference;
        console.log(`[ASAAS WEBHOOK] Successfully fetched externalReference from Asaas subscription: ${externalReference}`);
      } catch (subErr: any) {
        console.error(`[ASAAS WEBHOOK] Failed to fetch subscription details from Asaas: ${subErr.message}`);
      }
    }

    console.log(`[ASAAS WEBHOOK] External Reference identified: ${externalReference}`);

    if (!externalReference) {
      console.log("[ASAAS WEBHOOK] Ignored - No externalReference found in payload");
      return res.status(200).json({ received: true, message: "Ignored - No reference found" });
    }

    const db = getDb();
    const sessionDoc = await getDoc(doc(db, "checkoutSessions", externalReference));
    
    if (!sessionDoc.exists()) {
      console.warn(`[ASAAS WEBHOOK] Session ${externalReference} not found in Firestore. Payment might be from an old session or different system.`);
      return res.status(200).json({ received: true, message: "Session not found in DB" });
    }

    const { uid, plan } = sessionDoc.data()!;
    const userRef = doc(db, "users", uid);
    
    console.log(`[ASAAS WEBHOOK] Processing for user ${uid}, plan ${plan}`);

    const isApproved = [
      'PAYMENT_CONFIRMED', 
      'PAYMENT_RECEIVED', 
      'SUBSCRIPTION_CREATED', 
      'PAYMENT_RECEIVED_IN_CASH',
      'PAYMENT_CONFIRMED_BY_BANK_SLIP'
    ].includes(event);
    
    const isFailed = [
      'PAYMENT_OVERDUE', 
      'PAYMENT_REFUNDED', 
      'PAYMENT_DELETED',
      'PAYMENT_CHARGEBACK_REQUESTED'
    ].includes(event);

    if (isApproved) {
      console.log(`[ASAAS WEBHOOK] PAYMENT APPROVED! Updating user ${uid} to active.`);
      const days = plan === 'anual' ? 365 : 30;
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + days);

      await updateDoc(userRef, {
        status: 'active',
        isActive: true,
        subscriptionStatus: 'active',
        subscriptionEndsAt: endsAt.toISOString(),
        plan: plan || 'mensal',
        paymentProvider: 'asaas',
        lastOrderId: payment?.id || subscription?.id || billing?.id,
        updatedAt: serverTimestamp(),
        ...AUTH_BYPASS
      });
      
      await updateDoc(doc(db, "checkoutSessions", externalReference), {
        status: 'completed', 
        updatedAt: serverTimestamp(), 
        webhookEvent: event,
        ...AUTH_BYPASS
      });
      console.log(`[ASAAS WEBHOOK] User ${uid} updated successfully. Subscription ends at: ${endsAt.toISOString()}`);
    } else if (isFailed) {
      console.log(`[ASAAS WEBHOOK] Payment failed/refunded for user ${uid}. Marking inactive.`);
      await updateDoc(userRef, {
        subscriptionStatus: 'inactive', 
        updatedAt: serverTimestamp(),
        ...AUTH_BYPASS
      });
    }

    return res.status(200).json({ success: true, processedEvent: event });
  } catch (error: any) {
    console.error(`[ASAAS WEBHOOK CRITICAL ERROR]: ${error.message}`);
    console.error(error.stack);
    return res.status(500).json({ error: "Internal server error during webhook processing" });
  }
};

app.get("/api/webhooks/asaas", (req, res) => {
  const tokenReceived = req.headers['asaas-access-token'] || req.headers['Asaas-Access-Token'];
  const hasConfiguredToken = !!ASAAS_WEBHOOK_TOKEN;
  
  res.json({ 
    status: "active",
    message: "Asaas Webhook endpoint is ready.",
    diagnostics: {
      firebase_active: !!(firebaseConfig && firebaseConfig.apiKey),
      firebase_project: firebaseConfig?.projectId || "not_found",
      asaas_token_configured: hasConfiguredToken,
      asaas_token_match_test: hasConfiguredToken ? (tokenReceived === ASAAS_WEBHOOK_TOKEN ? "MATCH" : "MISMATCH or NOT_PROVIDED") : "NOT_REQUIRED",
      node_env: process.env.NODE_ENV || 'production',
      cwd: process.cwd()
    },
    setup_guide: {
      webhook_url: "Use this URL in Asaas panel ending in /api/webhooks/asaas",
      events_required: ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "SUBSCRIPTION_CREATED"]
    }
  });
});
app.post("/api/webhooks/asaas", asaasWebhookHandler);
app.post("/webhooks/asaas", asaasWebhookHandler);

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
        status: "active",
        isActive: true,
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

// Endpoint to permanently delete a user from Firebase Auth & Firestore
const adminDeleteUserHandler = async (req: any, res: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autorizado: Token JWT ausente." });
  }

  const idToken = authHeader.split("Bearer ")[1];
  const { targetUid } = req.body;

  if (!targetUid) {
    return res.status(400).json({ error: "ID do usuário (targetUid) é obrigatório." });
  }

  try {
    // 1. Verificar o ID token do admin usando admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const adminEmail = decodedToken.email?.toLowerCase();
    const adminUid = decodedToken.uid;

    // 2. Validar permissão (CEO / Administrativa)
    const isAllowedEmail = adminEmail === "blsseparate7@gmail.com" || adminEmail === "gbfinancer@gmail.com";
    let isAllowed = isAllowedEmail;

    if (!isAllowed) {
      const db = getDb();
      const adminDoc = await getDoc(doc(db, "users", adminUid));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        if (adminData && adminData.role === 'admin') {
          isAllowed = true;
        }
      }
    }

    if (!isAllowed) {
      return res.status(403).json({ error: "Acesso negado: apenas administradores autorizados." });
    }

    console.log(`[CEO DELETE] Admin ${adminEmail} (${adminUid}) deleting target user ${targetUid}`);

    // 3. Excluir do Firebase Authentication (Auth)
    try {
      await admin.auth().deleteUser(targetUid);
      console.log(`[CEO DELETE] Usuário ${targetUid} removido com sucesso do Firebase Auth.`);
    } catch (authErr: any) {
      if (authErr.code === 'auth/user-not-found') {
        console.warn(`[CEO DELETE] Usuário ${targetUid} não existia no Firebase Auth (já removido ou inexistente).`);
      } else {
        throw authErr;
      }
    }

    // 4. Garantir exclusão física do documento Firestore
    const db = getDb();
    const userRef = doc(db, "users", targetUid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await deleteDoc(userRef);
      console.log(`[CEO DELETE] Documento firestore do usuário ${targetUid} excluído.`);
    }

    res.json({ success: true, message: `Usuário ${targetUid} excluído permanentemente.` });
  } catch (err: any) {
    console.error("[CEO DELETE ERROR]:", err.message);
    res.status(500).json({ error: err.message });
  }
};

app.post("/api/admin/delete-user", adminDeleteUserHandler);
app.post("/admin/delete-user", adminDeleteUserHandler);

export default app;
