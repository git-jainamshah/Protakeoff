import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../backend/src/app.js';

// Initialise Express app once (warm starts reuse this instance)
const app = createApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Pass Vercel's IncomingMessage/ServerResponse directly to Express
  return app(req as any, res as any, (err: unknown) => {
    if (err) {
      console.error('[API] Unhandled error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
}
