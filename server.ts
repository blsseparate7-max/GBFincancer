import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "gen-lang-client-0831890855"
  });
}

const db = getFirestore(admin.app(), "ai-studio-cbbf3152-22f0-457f-8339-02764ff647d3");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
      const sessionRef = db.collection("checkoutSessions").doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        console.error(`[WEBHOOK] Error: Checkout session ${sessionId} not found`);
        await db.collection("adminLogs").add({
          type: "subscription_update",
          userId: "unknown",
          action: "session_not_found",
          details: `Webhook received with session_id ${sessionId} but it does not exist. Order: ${order_id}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.status(404).json({ error: "Session not found" });
      }

      console.log(`[WEBHOOK] session encontrada: ${sessionId}`);
      const { uid } = sessionDoc.data()!;
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.error(`[WEBHOOK] Error: User ${uid} not found in Firestore`);
        await db.collection("adminLogs").add({
          type: "subscription_update",
          userId: uid,
          action: "user_not_found",
          details: `Webhook received for user ${uid} but user not found. Order: ${order_id}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.status(404).json({ error: "User not found" });
      }

      await db.collection("adminLogs").add({
        type: "subscription_update",
        userId: uid,
        action: "webhook_received",
        details: `Webhook Kiwify recebido para usuário ${uid}. Session: ${sessionId}. Status: ${order_status}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
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

          await db.collection("adminLogs").add({
            type: "subscription_update",
            userId: uid,
            action: "payment_approved",
            details: `Pagamento aprovado. Plano: ${plan?.name}. Expira em: ${subscriptionEndsAt}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Atualiza a sessão para 'completed'
          await sessionRef.update({ 
            status: "completed", 
            orderId: order_id,
            completedAt: admin.firestore.FieldValue.serverTimestamp() 
          });
          break;
        
        case "refunded":
        case "canceled":
        case "chargedback":
          subscriptionStatus = "inactive";
          subscriptionEndsAt = null;

          await db.collection("adminLogs").add({
            type: "subscription_update",
            userId: uid,
            action: "failed",
            details: `Assinatura cancelada/estornada via Kiwify. Status: ${order_status}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          await sessionRef.update({ 
            status: "failed", 
            reason: order_status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
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

      await userRef.update({
        subscriptionStatus,
        subscriptionEndsAt,
        plan: plan?.name?.toLowerCase().includes("anual") ? "anual" : "mensal",
        paymentProvider: "kiwify",
        lastOrderId: order_id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
