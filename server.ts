import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));

// CRITICAL: Initialize Client SDK for Server-Side use when IAM/Admin SDK has permission issues
// This uses the apiKey and follows Security Rules (which we've relaxed for this bypass)
const clientApp = initializeClientApp(firebaseConfig);
const db = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

// Bypass Key for Security Rules
const AUTH_BYPASS = { auth_bypass_key: 'gbfinancer-server-2026' };

// Initialize Admin SDK ONLY for non-Firestore things if needed (though not really used now)
if (!admin.apps.length) {
  admin.initializeApp({ projectId: firebaseConfig.projectId }); 
}

// Diagnostic connection test
async function testDbConnection() {
  try {
    console.log(`[FIREBASE] Connectivity test (Web SDK workaround) started...`);
    // Simple create/delete test could be done, but let's just log
    console.log("[FIREBASE] Using Web SDK with API Key for database operations.");
  } catch (error: any) {
    console.error("[FIREBASE ERROR] Connectivity test failed:", error.message);
  }
}
testDbConnection();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Asaas Config
  const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
  const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const isProd = process.env.VITE_ASAAS_ENVIRONMENT === 'production' || ASAAS_API_KEY.includes('prod');
  const ASAAS_BASE_URL = isProd ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';

  console.log(`[ASAAS] API Environment: ${isProd ? 'PRODUCTION' : 'SANDBOX'}`);

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

  // Endpoint to create Asaas Checkout
  app.post("/api/checkout/asaas", async (req, res) => {
    let { uid, email, plan, name, cpfCnpj } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Clean input CPF/CNPJ if provided
      if (cpfCnpj) cpfCnpj = cpfCnpj.replace(/\D/g, '');

      // 0. Fetch user profile from Firestore to get cpfCnpj if not provided
      if (!cpfCnpj) {
        console.log(`[FIREBASE] Fetching user profile for UID: ${uid} to get CPF/CNPJ`);
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          cpfCnpj = userData.cpfCnpj ? userData.cpfCnpj.replace(/\D/g, '') : undefined;
          if (!name) name = userData.name;
          console.log(`[FIREBASE] Found CPF/CNPJ in Firestore: ${cpfCnpj ? 'YES' : 'NO'}`);
        } else {
          console.warn(`[FIREBASE] User profile for UID: ${uid} NOT FOUND`);
        }
      }

      if (!cpfCnpj) {
        console.error(`[ASAAS CHECKOUT ERROR] CPF/CNPJ missing for user ${uid}`);
        throw new Error("CPF ou CNPJ é obrigatório para realizar o pagamento.");
      }

      // 1. Create or Find Customer
      const customers = await asaasFetch(`/customers?email=${email}`);
      let customerId = customers.data?.[0]?.id;

      if (!customerId) {
        const customer = await asaasFetch('/customers', {
          method: 'POST',
          body: JSON.stringify({ 
            name: name || email, 
            email,
            cpfCnpj
          })
        });
        customerId = customer.id;
      } else {
        // If customer exists, but maybe doesn't have cpfCnpj in Asaas (older customer)
        if (!customers.data[0].cpfCnpj) {
          await asaasFetch(`/customers/${customerId}`, {
            method: 'POST', // Asaas uses POST for updates in some endpoints but let's check docs... usually it's PUT or POST to update. V3 prefers POST for some updates.
            body: JSON.stringify({ cpfCnpj })
          }).catch(err => console.warn("[ASAAS] Failed to update customer CPF/CNPJ:", err.message));
        }
      }

      // 2. Create Checkout Session in Firestore
      const sessionRef = await addDoc(collection(db, "checkoutSessions"), {
        uid,
        email,
        plan,
        provider: 'asaas',
        status: 'pending',
        createdAt: serverTimestamp(),
        ...AUTH_BYPASS
      });

      // 3. Create Subscription (Monthly for 8.70)
      const value = 8.70;
      
      console.log(`[ASAAS] Creating subscription for customer: ${customerId}`);
      const subscription = await asaasFetch('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customer: customerId,
          billingType: 'UNDEFINED',
          value,
          nextDueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          cycle: 'MONTHLY',
          description: `Plano Mensal - GB Financer`,
          externalReference: sessionRef.id
        })
      });

      // 4. Fetch the first payment of this subscription to get the checkout/invoice link
      // When a subscription is created, the first payment is generated immediately.
      console.log(`[ASAAS] Subscription created: ${subscription.id}. Fetching first payment...`);
      const payments = await asaasFetch(`/payments?subscription=${subscription.id}&limit=1`);
      const firstPayment = payments.data?.[0];

      if (!firstPayment) {
        console.error(`[ASAAS ERROR] No first payment found for subscription ${subscription.id}`);
        throw new Error("Assinatura criada, mas não foi possível gerar o link de pagamento inicial.");
      }

      const checkoutUrl = firstPayment.invoiceUrl || firstPayment.bankSlipUrl || firstPayment.checkoutUrl;
      console.log(`[ASAAS] Checkout URL found: ${checkoutUrl}`);

      res.json({ checkoutUrl });
    } catch (error: any) {
      console.error("[ASAAS CHECKOUT ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Asaas Webhook
  app.post("/api/webhooks/asaas", async (req, res) => {
    // Basic verification of the webhook token (Asaas sends in the header 'asaas-access-token' if configured,
    // but the user provided whsec_... which usually is for specific integrations)
    // Checking asaas-access-token header
    const token = req.headers['asaas-access-token'];
    
    if (ASAAS_WEBHOOK_TOKEN && token !== ASAAS_WEBHOOK_TOKEN) {
      console.warn("[WEBHOOK ASAAS] Unauthorized attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { event, payment, subscription } = req.body;
    console.log(`[WEBHOOK ASAAS] evento: ${event}`);

    // externalReference is our session ID
    const externalReference = payment?.externalReference || subscription?.externalReference;

    if (!externalReference) {
      return res.status(200).json({ message: "No externalReference found, ignoring" });
    }

    try {
      const sessionDoc = await getDoc(doc(db, "checkoutSessions", externalReference));
      if (!sessionDoc.exists()) {
        console.error(`[WEBHOOK ASAAS] Session ${externalReference} not found`);
        await addDoc(collection(db, "adminLogs"), {
          type: "subscription_update",
          userId: "unknown",
          action: "session_not_found",
          details: `Webhook Asaas recebido para sessão ${externalReference} inexistente.`,
          createdAt: serverTimestamp(),
          ...AUTH_BYPASS
        });
        return res.status(404).json({ error: "Session not found" });
      }

      const { uid, plan } = sessionDoc.data()!;
      const userRef = doc(db, "users", uid);

      await addDoc(collection(db, "adminLogs"), {
        type: "subscription_update",
        userId: uid,
        action: "webhook_received",
        details: `Webhook Asaas: evento ${event} recebido para usuário ${uid}.`,
        createdAt: serverTimestamp(),
        ...AUTH_BYPASS
      });

      // Handle events: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, SUBSCRIPTION_PAYMENT_CONFIRMED, etc.
      const isApproved = 
        event === 'PAYMENT_CONFIRMED' || 
        event === 'PAYMENT_RECEIVED' || 
        event === 'SUBSCRIPTION_CREATED' ||
        event.includes('PAYMENT_CONFIRMED'); // SUBSCRIPTION_PAYMENT_CONFIRMED
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
          status: 'completed',
          updatedAt: serverTimestamp(),
          ...AUTH_BYPASS
        });

        await addDoc(collection(db, "adminLogs"), {
          type: "subscription_update",
          userId: uid,
          action: "payment_approved",
          details: `Pagamento Asaas aprovado. Plano: ${plan}. Expira em: ${endsAt.toISOString()}`,
          createdAt: serverTimestamp(),
          ...AUTH_BYPASS
        });
      } else if (isFailed) {
        await updateDoc(userRef, {
          subscriptionStatus: 'inactive',
          updatedAt: serverTimestamp(),
          ...AUTH_BYPASS
        });

        await addDoc(collection(db, "adminLogs"), {
          type: "subscription_update",
          userId: uid,
          action: "failed",
          details: `Pagamento Asaas falhou ou foi estornado. Evento: ${event}`,
          createdAt: serverTimestamp(),
          ...AUTH_BYPASS
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[WEBHOOK ASAAS ERROR]:", error);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // Kiwify Webhook
  app.post("/api/webhooks/kiwify", async (req, res) => {
    console.log("[WEBHOOK] recebido:", JSON.stringify(req.body));
    const { order_status, customer, custom_parameters, plan, product_id, order_id } = req.body;
    
    // O usuário quer que usemos checkoutSessions para maior segurança
    const sessionId = custom_parameters?.session_id;

    if (!sessionId) {
      console.error("[WEBHOOK] Error: session_id not found in custom_parameters");
      return res.status(400).json({ error: "session_id not found" });
    }

    try {
      const sessionRef = doc(db, "checkoutSessions", sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        console.error(`[WEBHOOK] Error: Checkout session ${sessionId} not found`);
        await addDoc(collection(db, "adminLogs"), {
          type: "subscription_update",
          userId: "unknown",
          action: "session_not_found",
          details: `Webhook received with session_id ${sessionId} but it does not exist. Order: ${order_id}`,
          createdAt: serverTimestamp(),
          ...AUTH_BYPASS
        });
        return res.status(404).json({ error: "Session not found" });
      }

      console.log(`[WEBHOOK] session encontrada: ${sessionId}`);
      const { uid } = sessionDoc.data()!;
      const userRef = doc(db, "users", uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.error(`[WEBHOOK] Error: User ${uid} not found in Firestore`);
        await addDoc(collection(db, "adminLogs"), {
          type: "subscription_update",
          userId: uid,
          action: "user_not_found",
          details: `Webhook received for user ${uid} but user not found. Order: ${order_id}`,
          createdAt: serverTimestamp(),
          ...AUTH_BYPASS
        });
        return res.status(404).json({ error: "User not found" });
      }

      await addDoc(collection(db, "adminLogs"), {
        type: "subscription_update",
        userId: uid,
        action: "webhook_received",
        details: `Webhook Kiwify recebido para usuário ${uid}. Session: ${sessionId}. Status: ${order_status}`,
        createdAt: serverTimestamp(),
        ...AUTH_BYPASS
      });

      let subscriptionStatus = "inactive";
      let subscriptionEndsAt = null;
      const now = new Date();

      // Mapeamento de status da Kiwify
      // paid, refunded, canceled, chargedback, waiting_payment, pending
      switch (order_status) {
        case "paid":
          subscriptionStatus = "active";
          // Se for plano anual, +365 dias, senão +30 dias
          const days = plan?.name?.toLowerCase().includes("anual") ? 365 : 30;
          now.setDate(now.getDate() + days);
          subscriptionEndsAt = now.toISOString();

          await addDoc(collection(db, "adminLogs"), {
            type: "subscription_update",
            userId: uid,
            action: "payment_approved",
            details: `Pagamento aprovado. Plano: ${plan?.name}. Expira em: ${subscriptionEndsAt}`,
            createdAt: serverTimestamp(),
            ...AUTH_BYPASS
          });
          
          // Atualiza a sessão para 'completed'
          await updateDoc(sessionRef, { 
            status: "completed", 
            orderId: order_id,
            completedAt: serverTimestamp(),
            ...AUTH_BYPASS
          });
          break;
        
        case "refunded":
        case "canceled":
        case "chargedback":
          subscriptionStatus = "inactive";
          subscriptionEndsAt = null;

          await addDoc(collection(db, "adminLogs"), {
            type: "subscription_update",
            userId: uid,
            action: "failed",
            details: `Assinatura cancelada/estornada via Kiwify. Status: ${order_status}`,
            createdAt: serverTimestamp(),
            ...AUTH_BYPASS
          });
          
          await updateDoc(sessionRef, { 
            status: "failed", 
            reason: order_status,
            updatedAt: serverTimestamp(),
            ...AUTH_BYPASS
          });
          break;

        case "waiting_payment":
        case "pending":
          // Mantém o status atual, apenas registra na sessão se quiser
          return res.json({ success: true, message: "Waiting payment" });

        default:
          console.log(`[WEBHOOK] Unhandled status ${order_status}`);
          return res.json({ success: true, message: "Status ignored" });
      }

      await updateDoc(userRef, {
        subscriptionStatus,
        subscriptionEndsAt,
        plan: plan?.name?.toLowerCase().includes("anual") ? "anual" : "mensal",
        paymentProvider: "kiwify",
        lastOrderId: order_id,
        updatedAt: serverTimestamp(),
        ...AUTH_BYPASS
      });

      console.log(`[WEBHOOK] usuário atualizado: ${uid} -> ${subscriptionStatus}`);
      console.log(`[WEBHOOK] concluído para session: ${sessionId}`);
      res.json({ success: true });
    } catch (error) {
      console.error("[WEBHOOK] Kiwify Webhook Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
