
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  
  // Cloud Run uses PORT env var (usually 8080). AI Studio uses 3000.
  const PORT = process.env.PORT || 8080;

  // 1. Environment Variable Check
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Warning: GEMINI_API_KEY is not set. AI features may not work.');
  }

  // 2. Enable CORS
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Title', 'HTTP-Referer'],
    credentials: true
  }));

  app.use(express.json());

  // 3. Proxy for OpenRouter
  app.post('/api/magnum', async (req, res) => {
    try {
      const { messages, model, stream, temperature, max_tokens } = req.body;
      const apiKey = req.headers.authorization;

      if (!apiKey) {
        return res.status(401).json({ error: 'API Key is missing' });
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
          'HTTP-Referer': (req.headers['http-referer'] as string) || 'https://novelcraft.app',
          'X-Title': 'NovelCraft'
        },
        body: JSON.stringify({
          messages,
          model,
          stream,
          temperature,
          max_tokens
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).send(errorText);
      }

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is empty');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        const data = await response.json();
        res.json(data);
      }
    } catch (error: any) {
      console.error('Magnum Proxy Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 4. Vite middleware for development / Static serving for production
  if (process.env.NODE_ENV !== 'production') {
    try {
      // Dynamic import to avoid loading vite in production
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite development middleware loaded.');
    } catch (e) {
      console.error('Failed to load Vite middleware:', e);
    }
  } else {
    const distPath = path.join(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(distPath)) {
      console.error('CRITICAL ERROR: "dist" folder not found. Please run "npm run build" before starting the server.');
    }

    app.use(express.static(distPath));
    
    // Fix PathError: Use wildcard for Express 5
    app.get('(.*)', (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build files missing. Please ensure the project is built correctly.');
      }
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server is listening on 0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
