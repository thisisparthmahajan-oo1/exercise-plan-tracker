import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { requireAuth, sessionHandler } from './auth';
import type { Collections } from './mongo';
import { pullHandler, pushHandler } from './sync';

// Installs middleware and routes on an Express app. The entry point owns the
// app instance (src/index.ts; tests build their own). Collections are fetched
// per request, not here, so this runs synchronously — serverless hosts import
// the app and handle the first request before any connection exists.
export function configureApp(
  app: Express,
  getCols: () => Promise<Collections>,
  appToken: string,
): Express {
  // CORS for the web build of the app. Any origin is fine: auth is a bearer
  // session in a header, never a cookie, so a foreign page can't ride on it.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return void res.status(204).end();
    next();
  });

  // 200 rows of a few hundred bytes each fits comfortably.
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/auth/session', sessionHandler(appToken));

  const auth = requireAuth(appToken);
  app.post('/sync/push', auth, pushHandler(getCols));
  app.get('/sync/pull', auth, pullHandler(getCols));

  // JSON errors instead of Express's HTML page; the client shows `error`.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  });

  return app;
}
