import { prisma } from "../config/db.js";

/**
 * Bloque l'accès aux fonctionnalités payantes si l'utilisateur n'a ni abonnement actif
 * ni quota gratuit restant — SAUF pour le compte propriétaire (role ADMIN), qui a un
 * accès illimité par défaut : c'est son site, il doit pouvoir l'utiliser librement
 * pour tester et faire la démo, sans jamais être bloqué par le tunnel de paiement.
 */
export async function requireActiveAccess(req, res, next) {
  if (req.user.role === "ADMIN") {
    return next(); // accès illimité, aucune vérification supplémentaire
  }

  const activeSubscription = await prisma.subscription.findFirst({
    where: { userId: req.user.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
  });

  if (activeSubscription) return next();

  // TODO : brancher ici le suivi du quota gratuit (ex: 5 suggestions / mois)
  // avant de bloquer complètement un utilisateur sans abonnement.
  return res.status(402).json({
    error: "Abonnement requis pour continuer à utiliser cette fonctionnalité.",
    code: "SUBSCRIPTION_REQUIRED",
  });
}
