export function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Accès réservé aux administrateurs." });
  }
  next();
}
