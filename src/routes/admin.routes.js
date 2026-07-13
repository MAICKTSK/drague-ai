import { Router } from "express";
import { prisma } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { adminMiddleware } from "../middleware/admin.middleware.js";

const router = Router();

router.use(authMiddleware, adminMiddleware);

// Vue d'ensemble : chiffres clés du dashboard
router.get("/stats", async (req, res) => {
  const [totalUsers, activeSubscriptions, successPayments, successWithdrawals, pendingWithdrawals] =
    await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.payment.findMany({ where: { status: "SUCCESS" } }),
      prisma.withdrawal.findMany({ where: { status: "SUCCESS" } }),
      prisma.withdrawal.count({ where: { status: "PENDING" } }),
    ]);

  const totalCollectedUSD = successPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalWithdrawnUSD = successWithdrawals.reduce((sum, w) => sum + w.amountUSD, 0);
  const availableBalanceUSD = totalCollectedUSD - totalWithdrawnUSD;

  res.json({
    totalUsers,
    activeSubscriptions,
    totalCollectedUSD,
    totalWithdrawnUSD,
    availableBalanceUSD,
    pendingWithdrawals,
  });
});

// Liste des utilisateurs avec leur abonnement courant
router.get("/users", async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      phone: true,
      country: true,
      role: true,
      authProvider: true,
      createdAt: true,
      subscriptions: {
        where: { status: "ACTIVE" },
        include: { plan: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

// Liste des paiements (audit / suivi financier)
router.get("/payments", async (req, res) => {
  const payments = await prisma.payment.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(payments);
});

// Liste des retraits USDT en attente ou traités
router.get("/withdrawals", async (req, res) => {
  const withdrawals = await prisma.withdrawal.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(withdrawals);
});

// Activité récente (dernières conversations générées, tous utilisateurs confondus)
router.get("/activity", async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    include: { user: { select: { email: true } }, suggestions: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(conversations);
});

export default router;
