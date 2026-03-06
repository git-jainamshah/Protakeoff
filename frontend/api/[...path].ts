import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { IncomingMessage } from 'http';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const railwayUrl = process.env.RAILWAY_URL;

  if (!railwayUrl) {
    return res.status(503).json({
      error: 'Backend not configured.',
      hint: 'Set the RAILWAY_URL environment variable in your Vercel project settings.',
    });
  }

  const base = railwayUrl.replace(/\/$/, '');
  const targetUrl = `${base}${req.url}`;

  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === 'host') continue;
    if (value !== undefined) {
      forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
    }
  }

  const hasBody = !['GET', 'HEAD'].includes((req.method || 'GET').toUpperCase());
  const body = hasBody ? await readBodyBuffer(req) : undefined;

  try {
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body && body.length > 0 ? (body as unknown as BodyInit) : undefined,
    });

    res.status(proxyRes.status);

    proxyRes.headers.forEach((value, key) => {
      const skip = ['transfer-encoding', 'connection', 'keep-alive', 'content-encoding'];
      if (!skip.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const responseBuffer = await proxyRes.arrayBuffer();
    res.end(Buffer.from(responseBuffer));
  } catch (err) {
    console.error('[Proxy] Error forwarding request to Railway:', err);
    res.status(502).json({ error: 'Backend proxy error. The backend may be starting up, please retry.' });
  }
}
