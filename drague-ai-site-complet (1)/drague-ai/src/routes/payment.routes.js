import { Router } from "express";
import { prisma } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { adminMiddleware } from "../middleware/admin.middleware.js";
import {
  initMobileMoneyPayment,
  verifyMobileMoneyWebhookSignature,
} from "../services/payment/mobileMoney.service.js";
import {
  createStripeCheckoutSession,
  constructStripeEvent,
} from "../services/payment/stripe.service.js";
import {
  createCryptoInvoice,
  verifyCryptoWebhookSignature,
  payoutUSDT,
} from "../services/payment/crypto.service.js";
import { randomUUID } from "crypto";

const router = Router();

// --- Initialisation d'un paiement ---

// Mobile Money — tous pays d'Afrique via Flutterwave
router.post("/init/mobile-money", authMiddleware, async (req, res) => {
  const { planId, phone, country } = req.body; // country : code ISO, ex "CG", "KE", "NG"...

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: "Offre introuvable." });

  const transactionRef = randomUUID();

  const subscription = await prisma.subscription.create({
    data: { userId: req.user.id, planId, status: "PENDING" },
  });

  await prisma.payment.create({
    data: {
      userId: req.user.id,
      subscriptionId: subscription.id,
      method: "MOBILE_MONEY",
      provider: "flutterwave",
      providerRef: transactionRef,
      amount: plan.priceUSD,
      currency: "USD",
      status: "PENDING",
    },
  });

  const { paymentUrl } = await initMobileMoneyPayment({
    transactionRef,
    amountUSD: plan.priceUSD,
    customerEmail: req.user.email,
    customerPhone: phone,
    countryCode: country,
    description: `Abonnement ${plan.name}`,
  });

  res.json({ paymentUrl });
});

// Carte bancaire — Visa, Mastercard, American Express via Stripe
router.post("/init/card", authMiddleware, async (req, res) => {
  const { planId } = req.body;

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: "Offre introuvable." });

  const subscription = await prisma.subscription.create({
    data: { userId: req.user.id, planId, status: "PENDING" },
  });

  const { checkoutUrl, sessionId } = await createStripeCheckoutSession({
    userId: req.user.id,
    planName: plan.name,
    amountUSD: plan.priceUSD,
  });

  await prisma.payment.create({
    data: {
      userId: req.user.id,
      subscriptionId: subscription.id,
      method: "CARD",
      provider: "stripe",
      providerRef: sessionId,
      amount: plan.priceUSD,
      currency: "USD",
      status: "PENDING",
    },
  });

  res.json({ checkoutUrl });
});

// Cryptomonnaie — paiement direct de l'abonnement en crypto
router.post("/init/crypto", authMiddleware, async (req, res) => {
  const { planId } = req.body;

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: "Offre introuvable." });

  const subscription = await prisma.subscription.create({
    data: { userId: req.user.id, planId, status: "PENDING" },
  });

  const { invoiceUrl, invoiceId } = await createCryptoInvoice({
    orderId: subscription.id,
    amountUSD: plan.priceUSD,
    description: `Abonnement ${plan.name}`,
  });

  await prisma.payment.create({
    data: {
      userId: req.user.id,
      subscriptionId: subscription.id,
      method: "CRYPTO",
      provider: "nowpayments",
      providerRef: invoiceId.toString(),
      amount: plan.priceUSD,
      currency: "USD",
      status: "PENDING",
    },
  });

  res.json({ invoiceUrl });
});

// --- Webhooks (monter avec express.raw() dans server.js pour Stripe) ---

router.post("/webhook/mobile-money", async (req, res) => {
  const valid = verifyMobileMoneyWebhookSignature(req.headers["verif-hash"]);
  if (!valid) return res.status(401).json({ error: "Signature invalide." });

  const { tx_ref, status } = req.body.data ?? req.body;

  const payment = await prisma.payment.findFirst({ where: { providerRef: tx_ref } });
  if (!payment) return res.status(404).json({ error: "Paiement introuvable." });

  if (status === "successful") {
    await activateSubscription(payment);
  } else {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
  }

  res.sendStatus(200);
});

router.post("/webhook/stripe", async (req, res) => {
  let event;
  try {
    event = constructStripeEvent(req.body, req.headers["stripe-signature"]);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const payment = await prisma.payment.findFirst({ where: { providerRef: session.id } });
    if (payment) await activateSubscription(payment);
  }

  res.sendStatus(200);
});

router.post("/webhook/crypto", async (req, res) => {
  const rawBody = JSON.stringify(req.body);
  const valid = verifyCryptoWebhookSignature(rawBody, req.headers["x-nowpayments-sig"]);
  if (!valid) return res.status(401).json({ error: "Signature invalide." });

  const { order_id, payment_status } = req.body;

  const payment = await prisma.payment.findFirst({ where: { subscriptionId: order_id } });
  if (!payment) return res.status(404).json({ error: "Paiement introuvable." });

  if (payment_status === "finished" || payment_status === "confirmed") {
    await activateSubscription(payment);
  } else if (payment_status === "failed" || payment_status === "expired") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
  }

  res.sendStatus(200);
});

async function activateSubscription(payment) {
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS" } });

  if (payment.subscriptionId) {
    const now = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + 30);

    await prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: { status: "ACTIVE", startedAt: now, expiresAt: expires },
    });
  }
}

// --- Retrait en cryptomonnaie (USDT) — réservé au compte propriétaire (ADMIN) ---

const WITHDRAWAL_MIN_USD = 1;
const WITHDRAWAL_MAX_USD = 100000;

router.post("/withdraw/usdt", authMiddleware, adminMiddleware, async (req, res) => {
  const { amountUSD, walletAddress, network } = req.body;

  if (typeof amountUSD !== "number" || amountUSD < WITHDRAWAL_MIN_USD || amountUSD > WITHDRAWAL_MAX_USD) {
    return res.status(400).json({
      error: `Le montant du retrait doit être compris entre ${WITHDRAWAL_MIN_USD} $ et ${WITHDRAWAL_MAX_USD} $.`,
    });
  }

  if (!walletAddress || !network) {
    return res.status(400).json({ error: "Adresse wallet et réseau requis." });
  }

  const withdrawal = await prisma.withdrawal.create({
    data: { userId: req.user.id, amountUSD, walletAddress, network, status: "PENDING" },
  });

  try {
    const result = await payoutUSDT({ amountUSDT: amountUSD, walletAddress, network });
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "SUCCESS", providerRef: result.id?.toString() },
    });
    res.json({ success: true, withdrawal });
  } catch (err) {
    await prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { status: "FAILED" } });
    res.status(500).json({ error: "Échec du retrait en USDT." });
  }
});

export default router;
