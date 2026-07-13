import axios from "axios";
import crypto from "crypto";

const FLW_BASE_URL = "https://api.flutterwave.com/v3";

/**
 * Initialise un paiement Mobile Money via Flutterwave.
 * Flutterwave couvre le Mobile Money dans la grande majorité des pays africains
 * (Afrique de l'Ouest, Afrique centrale, Afrique de l'Est) via un seul contrat.
 *
 * @param {object} params
 * @param {string} params.transactionRef - Référence unique générée côté serveur
 * @param {number} params.amountUSD - Montant en USD (Flutterwave gère la conversion locale)
 * @param {string} params.customerEmail
 * @param {string} params.customerPhone
 * @param {string} params.countryCode - Code pays ISO (CG, CM, CI, KE, NG, SN...)
 * @param {string} params.description
 * @returns {Promise<{paymentUrl: string}>}
 */
export async function initMobileMoneyPayment({
  transactionRef,
  amountUSD,
  customerEmail,
  customerPhone,
  countryCode,
  description,
}) {
  const payload = {
    tx_ref: transactionRef,
    amount: amountUSD,
    currency: "USD",
    redirect_url: `${process.env.FRONTEND_URL}/payment/success`,
    payment_options: "mobilemoney",
    customer: {
      email: customerEmail,
      phonenumber: customerPhone,
    },
    customizations: {
      title: "Réplique",
      description,
    },
    meta: { country: countryCode },
  };

  const response = await axios.post(`${FLW_BASE_URL}/payments`, payload, {
    headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
  });

  if (response.data.status !== "success") {
    throw new Error(`Erreur Flutterwave : ${response.data.message}`);
  }

  return { paymentUrl: response.data.data.link };
}

/**
 * Vérifie la signature du webhook Flutterwave (header "verif-hash").
 */
export function verifyMobileMoneyWebhookSignature(signatureHeader) {
  return signatureHeader === process.env.FLW_WEBHOOK_SECRET_HASH;
}

/**
 * Revérifie le statut réel d'une transaction directement auprès de Flutterwave
 * (recommandé : ne jamais se fier uniquement au contenu du webhook).
 */
export async function verifyTransaction(transactionId) {
  const response = await axios.get(`${FLW_BASE_URL}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
  });
  return response.data;
}
