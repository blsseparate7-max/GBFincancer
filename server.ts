import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "gbfinancer-3491b"
  });
}

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Kiwify Webhook
  app.post("/api/webhooks/kiwify", async (req, res) => {
    const { order_status, customer } = req.body;
    const email = customer?.email;

    if (!email) {
      return res.status(400).json({ error: "Email not found" });
    }

    try {
      const usersRef = db.collection("users");
      const snapshot = await usersRef.where("email", "==", email).get();

      if (snapshot.empty) {
        // Se o usuário ainda não existe, podemos criar um registro prévio ou apenas ignorar
        // Por enquanto, vamos apenas registrar que esse email tem uma assinatura ativa
        await db.collection("subscriptions").doc(email).set({
          status: order_status === "paid" ? "ACTIVE" : "EXPIRED",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Atualiza todos os perfis vinculados a esse email
        const batch = db.batch();
        snapshot.forEach(doc => {
          batch.update(doc.ref, {
            subscriptionStatus: order_status === "paid" ? "ACTIVE" : "EXPIRED",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Kiwify Webhook Error:", error);
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
