import type {
  PullResponse,
  PushRequest,
  PushResponse,
  SessionRequest,
  SessionResponse,
} from './protocol';

// Inlined at build time from .env (EXPO_PUBLIC_ vars). Unset = sync disabled;
// the app works exactly as before.
export const SYNC_URL = process.env.EXPO_PUBLIC_SYNC_URL?.replace(/\/+$/, '') || null;

const TIMEOUT_MS = 20_000;

export class AuthError extends Error {}

async function request<T>(path: string, init: RequestInit & { token?: string }): Promise<T> {
  if (!SYNC_URL) throw new Error('Sync server is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SYNC_URL + path, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new AuthError(body.error ?? 'Not signed in');
    if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export const syncApi = {
  createSession(input: SessionRequest) {
    return request<SessionResponse>('/auth/session', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  push(token: string, body: PushRequest) {
    return request<PushResponse>('/sync/push', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    });
  },
  pull(token: string, since: number) {
    return request<PullResponse>(`/sync/pull?since=${since}`, { method: 'GET', token });
  },
};
