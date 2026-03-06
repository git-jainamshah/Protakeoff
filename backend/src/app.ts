import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import documentsRouter from './routes/documents.js';
import layersRouter from './routes/layers.js';
import shapesRouter from './routes/shapes.js';
import usersRouter from './routes/users.js';
import adminRouter from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        if (/\.vercel\.app$/.test(origin)) return callback(null, true);
        callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/layers', layersRouter);
  app.use('/api/shapes', shapesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/admin', adminRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', service: 'ProTakeOff API' });
  });

  // In production (non-Vercel, e.g. Render), serve the compiled React frontend.
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    const frontendDist = path.join(process.cwd(), '../frontend/dist');
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
