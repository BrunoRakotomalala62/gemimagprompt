
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Stocker les historiques de conversation par UID
const conversationHistory = new Map();

// Fonction pour télécharger une image et la convertir en base64
async function downloadImageAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  } catch (error) {
    throw new Error(`Error downloading image: ${error.message}`);
  }
}

// Route GET pour analyser une image
app.get('/', async (req, res) => {
  try {
    const { question, image, uid } = req.query;

    // Validation des paramètres
    if (!question || !uid) {
      return res.status(400).json({
        error: 'Missing required parameters: question and uid are required'
      });
    }

    // Vérifier si l'utilisateur veut effacer l'historique
    if (question.toLowerCase().trim() === 'clear') {
      conversationHistory.delete(uid);
      return res.json({ 
        message: 'Conversation history cleared',
        uid: uid 
      });
    }

    // Récupérer ou initialiser l'historique de conversation pour cet UID
    if (!conversationHistory.has(uid)) {
      conversationHistory.set(uid, []);
    }
    const history = conversationHistory.get(uid);

    // Initialiser Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    // Construire les parts pour cette requête
    const currentParts = [
      { text: question }
    ];

    // Si une image est fournie, l'ajouter
    if (image) {
      let imageData;
      
      // Si l'image est une URL, la télécharger et la convertir en base64
      if (image.startsWith('http://') || image.startsWith('https://')) {
        imageData = await downloadImageAsBase64(image);
      } else {
        // Si c'est déjà en base64
        imageData = image;
      }

      // Ajouter l'image en base64
      currentParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData,
        },
      });
    }

    // Créer le contenu complet avec l'historique
    const allParts = [...history, ...currentParts];

    const result = await model.generateContentStream(allParts);

    // Envoyer la réponse en streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    let fullResponse = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
    }

    // Transformer le format de la réponse
    let formattedResponse = fullResponse;

    // 1. Remplacer ### Titre par le format avec emoji
    formattedResponse = formattedResponse.replace(/###\s*(.+)/g, (match, title) => {
      return `✅🎯 ${title.toUpperCase().replace(/./g, char => {
        const boldMap = {
          'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
          'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
          'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
          '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵',
          'À': '𝗔̀', 'Â': '𝗔̂', 'É': '𝗘́', 'È': '𝗘̀', 'Ê': '𝗘̂', 'Î': '𝗜̂', 'Ô': '𝗢̂', 'Ù': '𝗨̀', 'Û': '𝗨̂',
          ' ': ' ', ':': ':', '\'': '\'', 'Œ': '𝗢𝗘'
        };
        return boldMap[char] || char;
      })}`;
    });

    // 2. Remplacer **texte** par texte en gras (sans les **)
    formattedResponse = formattedResponse.replace(/\*\*(.+?)\*\*/g, (match, text) => {
      return text.replace(/./g, char => {
        const boldMap = {
          'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
          'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
          'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
          'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
          'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
          'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
          '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵',
          'à': '𝗮̀', 'â': '𝗮̂', 'é': '𝗲́', 'è': '𝗲̀', 'ê': '𝗲̂', 'î': '𝗶̂', 'ô': '𝗼̂', 'ù': '𝘂̀', 'û': '𝘂̂',
          ' ': ' ', ':': ':', '\'': '\'', '-': '-', '/': '/', '=': '=', '.': '.'
        };
        return boldMap[char] || char;
      });
    });

    // 3. Supprimer tous les symboles LaTeX ($ et $$)
    formattedResponse = formattedResponse.replace(/\$\$/g, '');
    formattedResponse = formattedResponse.replace(/\$/g, '');

    // Envoyer la réponse formatée
    res.write(formattedResponse);
    res.end();

    // Ajouter la question et la réponse à l'historique
    history.push(...currentParts);
    history.push({ text: fullResponse });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Route pour obtenir l'historique d'une conversation
app.get('/history', (req, res) => {
  const { uid } = req.query;
  
  if (!uid) {
    return res.status(400).json({
      error: 'Missing required parameter: uid'
    });
  }

  const history = conversationHistory.get(uid) || [];
  res.json({
    uid: uid,
    messageCount: history.length,
    hasHistory: history.length > 0
  });
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uid: req.query.uid || 'none' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API ready at http://0.0.0.0:${PORT}/?question=YOUR_QUESTION&image=IMAGE_URL&uid=USER_ID`);
  console.log(`Clear conversation: http://0.0.0.0:${PORT}/?question=clear&uid=USER_ID`);
  console.log(`Check history: http://0.0.0.0:${PORT}/history?uid=USER_ID`);
});
