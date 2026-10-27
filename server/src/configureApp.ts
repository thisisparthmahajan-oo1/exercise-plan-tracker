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
