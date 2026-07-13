import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    // Pas de SMTP configuré (utile en développement) : le code sera juste affiché en console.
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Envoie le code de vérification à 5 chiffres par email.
 * En développement (sans SMTP configuré), le code est simplement affiché en console
 * pour pouvoir tester le flux sans vraie boîte mail.
 */
export async function sendVerificationCode(email, code) {
  const t = getTransporter();

  if (!t) {
    console.log(`[DEV] Code de vérification pour ${email} : ${code}`);
    return;
  }

  await t.sendMail({
    from: process.env.MAIL_FROM || "Drague.ai <no-reply@drague.ai>",
    to: email,
    subject: "Ton code de connexion Drague.ai",
    text: `Ton code de connexion est : ${code}\n\nIl expire dans 10 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.`,
    html: `<p>Ton code de connexion est : <strong style="font-size:20px;">${code}</strong></p>
           <p>Il expire dans 10 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`,
  });
}
