import Tesseract from "tesseract.js";

/**
 * Extrait le texte d'une capture d'écran (image) via OCR.
 * @param {string} imagePath - Chemin local de l'image uploadée
 * @returns {Promise<string>} Texte extrait
 */
export async function extractTextFromImage(imagePath) {
  const { data } = await Tesseract.recognize(imagePath, "fra+eng");
  return data.text;
}
