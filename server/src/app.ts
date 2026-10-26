import express from 'express';

import { loginHandler, requireAuth } from './auth';
import type { Collections } from './mongo';
import { pullHandler, pushHandler } from './sync';

export function createApp(cols: Collections, jwtSecret: string) {
  const app = express();
  // 500 rows of a few hundred bytes each fits comfortably.
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/auth/login', loginHandler(cols, jwtSecret));

  const auth = requireAuth(jwtSecret);
  app.post('/sync/push', auth, pushHandler(cols));
  app.get('/sync/pull', auth, pullHandler(cols));

  return app;
}
