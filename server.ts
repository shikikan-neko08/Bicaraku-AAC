import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());

  // API endpoint for AI suggestions
  app.post('/api/ai-suggestions', async (req, res) => {
    try {
      const { currentSentence } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured',
          suggestions: ['Saya', 'Mau', 'Tolong'],
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      const sentenceStr = Array.isArray(currentSentence) ? currentSentence.join(' ') : '';

      const prompt = `Anda adalah asisten AAC (Augmentative and Alternative Communication) untuk anak autis non-verbal di Indonesia.
Pengguna baru saja memilih kata: "${sentenceStr}".
Berikan 3 pilihan KATA TUNGGAL (hanya 1 kata saja per pilihan, tidak boleh frasa atau gabungan 2 kata) yang paling logis dan natural dalam bahasa Indonesia untuk melanjutkan kalimat tersebut.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const text = (response.text ?? '[]').trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const singleWords = parsed
          .map(item => String(item).trim().split(/\s+/)[0])
          .filter(Boolean)
          .slice(0, 3);
        if (singleWords.length > 0) {
          return res.json({ suggestions: singleWords });
        }
      }

      return res.json({ suggestions: ['Makan', 'Minum', 'Toilet'] });
    } catch (e) {
      console.error('Gemini server error:', e);
      return res.status(502).json({
        error: e instanceof Error ? e.message : 'Failed to fetch AI suggestions',
      });
    }
  });

  // In production, serve static files from dist
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Vite middleware for frontend dev
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
