import { createHmac, timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import type { SessionRequest, SessionResponse } from '../../src/sync/protocol';

// Single-owner access, same scheme as margin: the server has one APP_TOKEN.
// A device enters it once and gets back a session `<expiresAtMs>.<hmac>`
// signed with APP_TOKEN — the server keeps no session or user state, and
// changing APP_TOKEN signs every device out. Sessions are long-lived because
// sync runs silently in the background; an expired one just pauses sync until
// the token is entered again.

export const SESSION_TTL_MS = 365 * 24 * 60 * 60_000;

// Every synced row is stored under this owner. The field stays in the data
// model so separate accounts can be added later without migrating records.
export const OWNER_ID = 'owner';

const sign = (appToken: string, expiresAt: number) =>
  createHmac('sha256', appToken).update(`fitness-session:${expiresAt}`).digest('base64url');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createSession(appToken: string, now = Date.now()): SessionResponse {
  const expiresAt = now + SESSION_TTL_MS;
  return { session: `${expiresAt}.${sign(appToken, expiresAt)}`, expiresAt };
}

export function isValidSession(appToken: string, session: string, now = Date.now()): boolean {
  const [exp, sig] = session.split('.');
  const expiresAt = Number(exp);
  if (!sig || !Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return safeEqual(sig, sign(appToken, expiresAt));
}

const sessionRequestSchema = z.object({
  token: z.string().trim().min(1),
}) satisfies z.ZodType<SessionRequest, unknown>;

export function sessionHandler(appToken: string) {
  return (req: Request, res: Response) => {
    const parsed = sessionRequestSchema.safeParse(req.body);
    if (!parsed.success || !safeEqual(parsed.data.token, appToken)) {
      return res.status(401).json({ error: 'That token doesn’t match the server' });
    }
    res.json(createSession(appToken));
  };
}

// Accepts a device session, or APP_TOKEN itself (handy for curl). Sets
// res.locals.userId, or 401s.
export function requireAuth(appToken: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!bearer) return res.status(401).json({ error: 'Not signed in' });
    if (!isValidSession(appToken, bearer) && !safeEqual(bearer, appToken)) {
      return res.status(401).json({ error: 'Session expired — enter the token again' });
    }
    res.locals.userId = OWNER_ID;
    next();
  };
}
