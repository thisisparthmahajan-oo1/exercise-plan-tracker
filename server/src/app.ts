import express, { type NextFunction, type Request, type Response } from 'express';

import { loginHandler, requireAuth } from './auth';
import type { Collections } from './mongo';
import { pullHandler, pushHandler } from './sync';

// Collections are fetched per request (not at construction) so the app can be
// created synchronously — serverless hosts import it and handle the first
// request before any connection exists.
export function createApp(getCols: () => Promise<Collections>, jwtSecret: string) {
  const app = express();
  // 200 rows of a few hundred bytes each fits comfortably.
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/auth/login', loginHandler(getCols, jwtSecret));

  const auth = requireAuth(jwtSecret);
  app.post('/sync/push', auth, pushHandler(getCols));
  app.get('/sync/pull', auth, pullHandler(getCols));

  // JSON errors instead of Express's HTML page; the client shows `error`.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  });

  return app;
}
