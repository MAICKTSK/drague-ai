import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import appleSignin from "apple-signin-auth";
import { prisma } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { sendVerificationCode } from "../services/mail.service.js";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- Connexion par code à 5 chiffres envoyé par email (aucun mot de passe requis) ---

router.post("/request-code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requis." });

  const code = Math.floor(10000 + Math.random() * 90000).toString(); // 5 chiffres
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // valide 10 minutes

  await prisma.emailOtp.create({
    data: { email: email.toLowerCase(), codeHash, expiresAt },
  });

  await sendVerificationCode(email, code);

  res.json({ message: "Code envoyé. Vérifie ta boîte mail." });
});

router.post("/verify-code", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Email et code requis." });

  const normalizedEmail = email.toLowerCase();

  const otp = await prisma.emailOtp.findFirst({
    where: { email: normalizedEmail, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return res.status(401).json({ error: "Code expiré ou introuvable. Demande un nouveau code." });
  }

  const valid = await bcrypt.compare(code, otp.codeHash);
  if (!valid) {
    return res.status(401).json({ error: "Code incorrect." });
  }

  await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  // Le compte propriétaire est reconnu automatiquement si l'email correspond à OWNER_EMAIL,
  // configuré uniquement côté serveur (jamais exposé au client).
  const isOwner =
    !!process.env.OWNER_EMAIL && normalizedEmail === process.env.OWNER_EMAIL.toLowerCase();

  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  let needsProfileCompletion = false;

  if (!user) {
    const tempUsername = isOwner ? "admin" : `user_${Date.now().toString(36)}`;
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: tempUsername,
        displayName: isOwner ? "Propriétaire" : tempUsername,
        authProvider: "EMAIL",
        role: isOwner ? "ADMIN" : "USER",
      },
    });
    needsProfileCompletion = !isOwner;
  } else if (isOwner && user.role !== "ADMIN") {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }

  const token = signToken(user);
  res.json({ token, user: sanitize(user), needsProfileCompletion });
});

// --- Inscription classique (email + mot de passe + choix du username), toujours disponible en option ---
router.post("/register", async (req, res) => {
  const { email, password, username, displayName, phone, country } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: "Email, mot de passe et nom d'utilisateur requis." });
  }

  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username } }),
  ]);

  if (existingEmail) return res.status(409).json({ error: "Un compte existe déjà avec cet email." });
  if (existingUsername) return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName: displayName || username,
      passwordHash,
      phone,
      country,
      authProvider: "EMAIL",
    },
  });

  const token = signToken(user);
  res.status(201).json({ token, user: sanitize(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Identifiants invalides." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Identifiants invalides." });

  const token = signToken(user);
  res.json({ token, user: sanitize(user) });
});

// --- Connexion via Google ("Sign in with Google") ---
router.post("/google", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: "idToken manquant." });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: "Jeton Google invalide." });
  }

  const { sub, email } = payload;

  let user = await prisma.user.findFirst({
    where: { authProvider: "GOOGLE", providerId: sub },
  });

  let needsProfileCompletion = false;

  if (!user) {
    // Génère un username temporaire unique ; l'utilisateur le personnalisera ensuite.
    const tempUsername = `user_${sub.slice(-8)}`;
    user = await prisma.user.create({
      data: {
        email,
        username: tempUsername,
        displayName: tempUsername,
        authProvider: "GOOGLE",
        providerId: sub,
      },
    });
    needsProfileCompletion = true;
  }

  const token = signToken(user);
  res.json({ token, user: sanitize(user), needsProfileCompletion });
});

// --- Connexion via Apple ("Sign in with Apple") + reconnaissance automatique du propriétaire ---
router.post("/apple", async (req, res) => {
  const { identityToken } = req.body;
  if (!identityToken) return res.status(400).json({ error: "identityToken manquant." });

  let payload;
  try {
    payload = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_CLIENT_ID,
    });
  } catch (err) {
    return res.status(401).json({ error: "Jeton Apple invalide." });
  }

  const { sub, email } = payload;

  // On cherche d'abord par providerId (déjà lié à un précédent login Apple),
  // sinon par email (cas où le propriétaire a déjà un compte email/mot de passe à lier).
  let user = await prisma.user.findFirst({ where: { providerId: sub } });
  if (!user && email) {
    user = await prisma.user.findUnique({ where: { email } });
  }

  let needsProfileCompletion = false;

  // Le compte propriétaire est reconnu automatiquement si l'email vérifié par Apple
  // correspond à OWNER_APPLE_EMAIL, configuré uniquement côté serveur (jamais exposé au client).
  const isOwner =
    !!process.env.OWNER_APPLE_EMAIL &&
    !!email &&
    email.toLowerCase() === process.env.OWNER_APPLE_EMAIL.toLowerCase();

  if (!user) {
    const tempUsername = isOwner ? "admin" : `user_${sub.slice(-8)}`;
    user = await prisma.user.create({
      data: {
        email,
        username: tempUsername,
        displayName: isOwner ? "Propriétaire" : tempUsername,
        authProvider: "APPLE",
        providerId: sub,
        role: isOwner ? "ADMIN" : "USER",
      },
    });
    needsProfileCompletion = !isOwner;
  } else {
    // Compte déjà existant (créé via email/mot de passe ou Google) : on lie le sub Apple
    // pour les prochains logins, et on réaffirme le rôle ADMIN si c'est bien le propriétaire.
    const updates = {};
    if (!user.providerId) updates.providerId = sub;
    if (isOwner && user.role !== "ADMIN") updates.role = "ADMIN";
    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: updates });
    }
  }

  const token = signToken(user);
  res.json({ token, user: sanitize(user), needsProfileCompletion });
});

// --- Complète le profil après une inscription via Google/Apple (choix définitif du username) ---
router.patch("/profile", authMiddleware, async (req, res) => {
  const { username, displayName } = req.body;

  if (username) {
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: req.user.id } },
    });
    if (taken) return res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { username, displayName },
  });

  res.json({ user: sanitize(user) });
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function sanitize(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export default router;

