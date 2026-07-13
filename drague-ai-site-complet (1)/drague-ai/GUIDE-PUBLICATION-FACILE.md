# Guide de publication de Drague.ai — avec Replit

Ton code est déjà sur GitHub. On va maintenant le publier avec **Replit**, un hébergeur pensé pour les débutants, avec une interface visuelle simple.

---

### Étape 1 — Créer un compte Replit
1. Va sur **replit.com**
2. Clique sur **"Sign up"**, connecte-toi avec ton compte GitHub (le plus simple)

### Étape 2 — Importer ton projet depuis GitHub
1. Une fois connecté, clique sur **"Create App"** (ou **"+"**)
2. Choisis l'option **"Import from GitHub"**
3. Sélectionne ton dépôt `drague-ai`
4. Replit détecte automatiquement que c'est un projet Node.js et propose une configuration — laisse les valeurs par défaut

### Étape 3 — Ajouter la base de données
1. Dans le menu de gauche de ton projet Replit, cherche l'icône **"Database"** (ou "PostgreSQL")
2. Clique dessus, puis **"Create a database"**
3. Replit crée la base et te donne automatiquement une variable `DATABASE_URL` — tu n'as rien à copier-coller, elle est injectée toute seule

### Étape 4 — Ajouter les variables secrètes
1. Dans le menu de gauche, cherche l'icône **"Secrets"** (un cadenas 🔒)
2. Clique sur **"+ New secret"** pour chacune de ces lignes, une par une :

| Nom (Key) | Valeur (Value) |
|---|---|
| `JWT_SECRET` | Une phrase longue et secrète de ton choix, ex: `mon-secret-super-long-drague-2026` |
| `OWNER_EMAIL` | Ton email |
| `OWNER_APPLE_EMAIL` | Le même email |
| `ANTHROPIC_API_KEY` | Ta clé API Claude (sur console.anthropic.com) |

Les autres (Stripe, Flutterwave, NowPayments, SMTP) peuvent attendre — le site fonctionne déjà sans pour la connexion et la navigation.

### Étape 5 — Lancer le site
1. Cherche le gros bouton **"Run"** en haut de l'écran, clique dessus
2. Une fenêtre "Console" s'ouvre en bas et affiche les logs — attends de voir `Serveur démarré sur le port ...`
3. Une fenêtre "Webview" apparaît avec un aperçu de ton site

### Étape 6 — Initialiser la base de données (une seule fois)
1. Cherche l'onglet **"Shell"** (une icône de terminal `>_`) dans le menu de gauche
2. Tape :
```
npx prisma migrate deploy
```
Appuie sur Entrée, attends que ça finisse.
3. Tape ensuite :
```
npm run prisma:seed-plans
```
Appuie sur Entrée.

### Étape 7 — Publier avec une vraie adresse permanente
1. En haut à droite, clique sur **"Deploy"**
2. Choisis le type **"Autoscale"** (gratuit pour démarrer)
3. Suis les instructions à l'écran, clique sur **"Deploy"**
4. Replit te donne une adresse publique du style `drague-ai.ton-compte.replit.app` — **c'est l'adresse de ton site en ligne**

---

## C'est fait

Ton site entier (page d'accueil, connexion, app, dashboard admin) est accessible à cette seule adresse. Il n'y a rien d'autre à relier ou configurer — l'API et le site sont au même endroit.

**Pour la suite**, reviens vers moi pour configurer, un par un et sans urgence :
- Stripe (paiement carte)
- Flutterwave (Mobile Money)
- NowPayments (crypto)
- Resend ou un autre SMTP (envoi d'email du code de connexion)
- Un vrai nom de domaine à la place de l'adresse `.replit.app`
