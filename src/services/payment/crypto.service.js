import axios from "axios";
import crypto from "crypto";

const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

/**
 * Crée une facture de paiement en cryptomonnaie pour un abonnement (le client paie en crypto).
 * NowPayments accepte de nombreuses cryptos (BTC, ETH, USDT...) et convertit le montant
 * affiché en USD au taux du jour.
 */
export async function createCryptoInvoice({ orderId, amountUSD, description }) {
  const response = await axios.post(
    `${NOWPAYMENTS_BASE_URL}/invoice`,
    {
      price_amount: amountUSD,
      price_currency: "usd",
      order_id: orderId,
      order_description: description,
      ipn_callback_url: `${process.env.BACKEND_URL}/api/payments/webhook/crypto`,
      success_url: `${process.env.FRONTEND_URL}/payment/success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    },
    { headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY } }
  );

  return { invoiceUrl: response.data.invoice_url, invoiceId: response.data.id };
}

/**
 * Déclenche un retrait (payout) en USDT vers l'adresse wallet fournie — réservé au compte propriétaire.
 * NB : NowPayments exige généralement une vérification KYC business + whitelisting IP avant activation.
 */
export async function payoutUSDT({ amountUSDT, walletAddress, network }) {
  const response = await axios.post(
    `${NOWPAYMENTS_BASE_URL}/payout`,
    {
      withdrawals: [
        {
          address: walletAddress,
          currency: network === "TRC20" ? "usdttrc20" : "usdtbsc",
          amount: amountUSDT,
        },
      ],
    },
    {
      headers: {
        "x-api-key": process.env.NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

/**
 * Vérifie la signature IPN (webhook) de NowPayments.
 */
export function verifyCryptoWebhookSignature(rawBody, signatureHeader) {
  const parsed = JSON.parse(rawBody);
  const sorted = JSON.stringify(parsed, Object.keys(parsed).sort());
  const expected = crypto
    .createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET)
    .update(sorted)
    .digest("hex");
  return expected === signatureHeader;
}
