import express from "express";
import "express-async-errors"; // permet aux erreurs des routes async d'arriver jusqu'au gestionnaire d'erreurs global
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import adminRoutes from "./routes/admin.routes.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // désactivé pour ne pas bloquer les pages HTML servies ci-dessous
app.use(cors({ origin: process.env.FRONTEND_URL || true }));

// Le webhook Stripe a besoin du corps brut (raw) AVANT le parseur JSON global
app.use("/api/payments/webhook/stripe", express.raw({ type: "application/json" }));
app.use(express.json());

// Limitation de débit basique contre les abus
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use("/api/", limiter);

// Limite plus stricte spécifiquement sur la demande de code par email :
// sans ça, n'importe qui pourrait spammer une boîte mail de codes de vérification.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Trop de demandes de code. Réessaie dans quelques minutes." },
});
app.use("/api/auth/request-code", otpLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Sert le site (page d'accueil, app, dashboard admin) directement depuis ce même serveur —
// un seul déploiement suffit, pas besoin d'un service séparé pour le frontend.
app.use(express.static(path.join(__dirname, "../public")));

// 404 propre pour toute route API inconnue (après les fichiers statiques, jamais avant)
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Route introuvable." });
});

// Gestionnaire d'erreurs global : évite qu'une erreur non gérée fasse planter
// le serveur ou renvoie une stack trace brute au client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: "Une erreur interne est survenue. Réessaie dans un instant.",
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
