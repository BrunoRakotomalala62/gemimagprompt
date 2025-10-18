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

    // Initialiser Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const parts = [
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
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData,
        },
      });
    }

    const result = await model.generateContentStream(parts);

    // Envoyer la réponse en streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(chunkText);
    }

    res.end();

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uid: req.query.uid || 'none' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API ready at http://0.0.0.0:${PORT}/?question=YOUR_QUESTION&image=IMAGE_URL&uid=USER_ID`);
});

