import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Crée une session de paiement Stripe Checkout pour un abonnement mensuel.
 */
export async function createStripeCheckoutSession({ userId, planName, amountUSD }) {
  const session = await stripe.checkout.sessions.create({
    mode: "payment", // ou "subscription" si vous utilisez les Stripe Subscriptions natives
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Abonnement ${planName}` },
          unit_amount: Math.round(amountUSD * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { userId },
    success_url: `${process.env.FRONTEND_URL}/payment/success`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
  });

  return { checkoutUrl: session.url, sessionId: session.id };
}

/**
 * Construit et vérifie l'événement webhook Stripe (signature obligatoire).
 */
export function constructStripeEvent(rawBody, signatureHeader) {
  return stripe.webhooks.constructEvent(
    rawBody,
    signatureHeader,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}
