import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Génère des suggestions de réponses à partir d'une conversation.
 * @param {string} conversationText - Texte brut de la conversation (importée ou issue de l'OCR)
 * @param {string} tone - Ton souhaité : "humour", "direct", "mystérieux"...
 * @returns {Promise<string[]>} Liste de suggestions
 */
export async function generateReplySuggestions(conversationText, tone = "naturel") {
  const systemPrompt = `Tu es un assistant qui aide une personne à formuler des réponses percutantes,
respectueuses et adaptées au contexte dans une conversation de séduction.
Règles impératives :
- Ne jamais suggérer de propos manipulateurs, dégradants, insistants après un refus, ou irrespectueux.
- Rester dans un registre bienveillant et consensuel.
- Adapter le ton demandé : "${tone}".
- Répondre uniquement avec une liste de 3 suggestions, sans commentaire additionnel.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Voici la conversation :\n\n${conversationText}\n\nPropose 3 réponses possibles.`,
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  // Découpage simple en lignes de suggestion (à affiner selon le format réel de sortie)
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Analyse une conversation et recommande la meilleure catégorie de réponse
 * parmi : punch, humour, approfondir, jeuxdemots.
 */
export async function classifyBestCategory(conversationText) {
  const system = `Tu analyses une conversation de séduction et tu dois recommander, parmi ces 4 catégories,
celle la plus adaptée pour relancer la discussion :
- "punch" : punchline choc, ton direct et confiant
- "humour" : réplique légère, drôle, inattendue
- "approfondir" : question ouverte pour développer la discussion et créer une vraie connexion
- "jeuxdemots" : jeu de mots spirituel et joueur

Réponds STRICTEMENT avec un objet JSON, sans aucun texte autour, au format :
{"category": "punch|humour|approfondir|jeuxdemots", "insight": "phrase courte en français expliquant pourquoi"}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
    system,
    messages: [{ role: "user", content: conversationText }],
  });

  return parseJsonResponse(message, { category: "punch", insight: "" });
}

/**
 * Situe une conversation dans le parcours guidé (Introduction → Conclusion).
 */
export async function classifyGuidedStage(conversationText) {
  const system = `Tu analyses une conversation de séduction et tu dois situer à quelle étape du parcours
elle se trouve, parmi ces 5 étapes numérotées : 0 = Introduction, 1 = Accroche, 2 = Complicité,
3 = Rapprochement, 4 = Conclusion.

Réponds STRICTEMENT avec un objet JSON, sans aucun texte autour, au format :
{"stepIndex": 0, "insight": "phrase courte en français expliquant pourquoi"}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
    system,
    messages: [{ role: "user", content: conversationText }],
  });

  return parseJsonResponse(message, { stepIndex: 0, insight: "" });
}

/**
 * Génère la réponse du coach personnel dans une conversation libre avec l'utilisateur.
 */
export async function generateCoachReply(history, userMessage) {
  const system = `Tu es un coach de séduction bienveillant. Tu aides une personne à réfléchir à sa situation
en posant des questions et en donnant des conseils construits — jamais en écrivant le message à sa place,
jamais moralisateur. Reste concret et chaleureux. Réponds en 2 à 4 phrases maximum, en français.`;

  const messages = [
    ...(history || []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    system,
    messages,
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function parseJsonResponse(message, fallback) {
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
