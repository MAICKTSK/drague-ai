import { Router } from "express";
import { prisma } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// Liste des plans disponibles
router.get("/plans", async (req, res) => {
  const plans = await prisma.plan.findMany();
  res.json(plans);
});

// Statut de l'abonnement en cours de l'utilisateur connecté
router.get("/me", authMiddleware, async (req, res) => {
  const subscription = await prisma.subscription.findFirst({
    where: { userId: req.user.id, status: "ACTIVE" },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(subscription || { status: "NONE" });
});

export default router;
