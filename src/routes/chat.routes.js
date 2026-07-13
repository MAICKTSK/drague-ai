import { Router } from "express";
import multer from "multer";
import { prisma } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireActiveAccess } from "../middleware/subscription.middleware.js";
import {
  generateReplySuggestions,
  classifyBestCategory,
  classifyGuidedStage,
  generateCoachReply,
} from "../services/ai.service.js";
import { extractTextFromImage } from "../services/ocr.service.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

// Import d'une conversation sous forme de texte (export WhatsApp .txt collé ou uploadé)
router.post("/import-text", authMiddleware, requireActiveAccess, async (req, res) => {
  const { text, tone } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Le champ 'text' est requis." });
  }

  const conversation = await prisma.conversation.create({
    data: {
      userId: req.user.id,
      sourceType: "text_import",
      rawContent: text,
    },
  });

  const suggestions = await generateReplySuggestions(text, tone);

  await prisma.suggestion.createMany({
    data: suggestions.map((content) => ({
      conversationId: conversation.id,
      content,
      tone,
    })),
  });

  res.json({ conversationId: conversation.id, suggestions });
});

// Import d'une capture d'écran (image) -> OCR -> suggestions
router.post(
  "/import-screenshot",
  authMiddleware,
  requireActiveAccess,
  upload.single("screenshot"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier reçu." });
    }

    const { tone } = req.body;
    const extractedText = await extractTextFromImage(req.file.path);

    const conversation = await prisma.conversation.create({
      data: {
        userId: req.user.id,
        sourceType: "screenshot",
        rawContent: extractedText,
      },
    });

    const suggestions = await generateReplySuggestions(extractedText, tone);

    await prisma.suggestion.createMany({
      data: suggestions.map((content) => ({
        conversationId: conversation.id,
        content,
        tone,
      })),
    });

    res.json({ conversationId: conversation.id, extractedText, suggestions });
  }
);

// Historique des conversations de l'utilisateur connecté
router.get("/history", authMiddleware, async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { userId: req.user.id },
    include: { suggestions: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(conversations);
});

// --- Recommandation de catégorie (bannière "conversation qui stagne") ---

router.post("/recommend-category", authMiddleware, requireActiveAccess, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Le champ 'text' est requis." });
  const result = await classifyBestCategory(text);
  res.json(result);
});

router.post(
  "/recommend-category/screenshot",
  authMiddleware,
  requireActiveAccess,
  upload.single("screenshot"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });
    const extractedText = await extractTextFromImage(req.file.path);
    const result = await classifyBestCategory(extractedText);
    res.json({ ...result, extractedText });
  }
);

// --- Assistant complet : situe la conversation dans le parcours guidé ---

router.post("/guided/analyze", authMiddleware, requireActiveAccess, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Le champ 'text' est requis." });
  const result = await classifyGuidedStage(text);
  res.json(result);
});

router.post(
  "/guided/analyze/screenshot",
  authMiddleware,
  requireActiveAccess,
  upload.single("screenshot"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });
    const extractedText = await extractTextFromImage(req.file.path);
    const result = await classifyGuidedStage(extractedText);
    res.json({ ...result, extractedText });
  }
);

// --- Coach personnel : conversation libre avec l'IA ---

router.post("/coach", authMiddleware, requireActiveAccess, async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Le champ 'message' est requis." });
  const reply = await generateCoachReply(history, message);
  res.json({ reply });
});

export default router;
