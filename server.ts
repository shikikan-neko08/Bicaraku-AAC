import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
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
        return res.json({ suggestions: ['Saya', 'Mau', 'Tolong', 'Sakit'] });
      }

      const ai = new GoogleGenAI({ apiKey });
      const sentenceStr = (currentSentence || []).join(' ');
      
      const prompt = `Anda adalah asisten AAC (Augmentative and Alternative Communication) untuk anak autis non-verbal di Indonesia. 
Pengguna baru saja mengetik kalimat: "${sentenceStr}".
Berikan 3 pilihan KATA TUNGGAL (hanya 1 kata saja per pilihan, tidak boleh frasa atau gabungan 2 kata) yang paling logis dan natural dalam bahasa Indonesia untuk melengkapi kalimat tersebut. 
Berikan hanya 3 kata dalam format JSON array of strings tanpa teks lain. Contoh: ["makan", "minum", "pulang"]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return res.json({ suggestions: parsed.slice(0, 3) });
        }
      }
      return res.json({ suggestions: ['Makan', 'Minum', 'Toilet', 'Main'] });
    } catch (e) {
      console.error('Gemini server error:', e);
      return res.json({ suggestions: ['Saya', 'Mau', 'Tolong', 'Sakit'] });
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
