import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import type { LoginRequest, LoginResponse } from '../../src/sync/protocol';
import type { Collections } from './mongo';

const TOKEN_TTL = '365d';

const loginSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  password: z.string().min(1),
}) satisfies z.ZodType<LoginRequest, unknown>;

export function loginHandler(cols: Collections, jwtSecret: string) {
  return async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
    const { email, password } = parsed.data;

    const user = await cols.users.findOne({ email });
    const ok = user != null && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Wrong email or password' });

    const token = jwt.sign({}, jwtSecret, { subject: user._id, expiresIn: TOKEN_TTL });
    const body: LoginResponse = { token, userId: user._id, email: user.email };
    res.json(body);
  };
}

// Populates res.locals.userId from a `Bearer <jwt>` header, or 401s.
export function requireAuth(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    try {
      const payload = jwt.verify(token, jwtSecret);
      if (typeof payload === 'string' || !payload.sub) throw new Error('bad token');
      res.locals.userId = payload.sub;
      next();
    } catch {
      res.status(401).json({ error: 'Session expired — sign in again' });
    }
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
