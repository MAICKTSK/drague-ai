// L'API est servie par ce même site, donc pas besoin de configurer d'adresse séparée.
window.DRAGUE_API_BASE_URL = window.DRAGUE_API_BASE_URL || "/api";

const TOKEN_KEY = "drague_token";
const USER_KEY = "drague_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isLoggedIn() {
  return !!getToken();
}

function isAdmin() {
  return getUser()?.role === "ADMIN";
}

/**
 * Appelle l'API backend avec le token d'authentification si disponible.
 * Envoie/reçoit du JSON par défaut.
 */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${window.DRAGUE_API_BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }
  return data;
}

/**
 * Redirige vers la page de connexion si l'utilisateur n'est pas authentifié.
 * À appeler en haut de chaque page qui nécessite une session.
 */
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
  }
}

/**
 * Redirige vers l'app si l'utilisateur connecté n'est pas le propriétaire (ADMIN).
 * À appeler en haut du dashboard admin.
 */
function requireAdmin() {
  requireAuth();
  if (!isAdmin()) {
    window.location.href = "app.html";
  }
}
