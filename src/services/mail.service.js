// Envoi via l'API HTTP de Resend plutôt que par SMTP classique : certains hébergeurs
// gratuits (dont Render) bloquent les connexions SMTP sortantes, mais jamais les requêtes HTTP.
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASS;

/**
 * Envoie le code de vérification à 5 chiffres par email.
 * En développement (sans clé Resend configurée), le code est simplement affiché en console
 * pour pouvoir tester le flux sans vraie boîte mail.
 */
export async function sendVerificationCode(email, code) {
  if (!RESEND_API_KEY) {
    console.log(`[DEV] Code de vérification pour ${email} : ${code}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Drague.ai <onboarding@resend.dev>",
      to: email,
      subject: "Ton code de connexion Drague.ai",
      text: `Ton code de connexion est : ${code}\n\nIl expire dans 10 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.`,
      html: `<p>Ton code de connexion est : <strong style="font-size:20px;">${code}</strong></p>
             <p>Il expire dans 10 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Échec de l'envoi de l'email (Resend) : ${errorBody}`);
  }
}
