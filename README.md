# Drague.ai

Assistant de séduction alimenté par l'IA — suggestions de réponses, punchlines, coach personnel, abonnement Mobile Money/carte/crypto.

## Structure du projet

Tout est réuni en un seul projet, un seul service à héberger :

```
drague-ai/
├── src/          → API (auth, IA, paiements, admin)
├── prisma/       → base de données
├── public/       → les pages du site (index.html, app.html, admin.html, login.html)
├── package.json
└── .env.example
```

Le serveur (`src/server.js`) fait deux choses à la fois : il répond à l'API (`/api/...`) **et** il sert directement les pages du site (`public/`). Ça veut dire **un seul déploiement, une seule adresse**, pas besoin de gérer deux services séparés.

## Déploiement — vue d'ensemble

1. Le code est sur GitHub ✅ (déjà fait)
2. Créer un service d'hébergement qui installe le projet et le fait tourner
3. Ajouter une base de données PostgreSQL
4. Remplir les variables d'environnement (les "clés secrètes")
5. Lancer les commandes d'initialisation de la base une seule fois

Le guide détaillé, avec les clics exacts, est dans **`GUIDE-PUBLICATION-FACILE.md`**.

## En développement local (optionnel, si un jour tu retouches le code toi-même)

```bash
npm install
cp .env.example .env   # puis remplis les vraies valeurs dans .env
npx prisma generate
npm run dev
```

Le site est alors sur `http://localhost:4000`.
