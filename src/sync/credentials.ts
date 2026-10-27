import { secureStorage } from './secureStorage';

// The device session (never the APP_TOKEN itself), kept out of SQLite in
// platform secure storage (Keychain on iOS).
export type Credentials = { session: string; expiresAt: number };

const KEY = 'sync.session';

export async function loadCredentials(): Promise<Credentials | null> {
  const raw = await secureStorage.get(KEY);
  if (!raw) return null;
  const creds = JSON.parse(raw) as Credentials;
  return creds.expiresAt > Date.now() ? creds : null;
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await secureStorage.set(KEY, JSON.stringify(creds));
}

export async function clearCredentials(): Promise<void> {
  await secureStorage.remove(KEY);
}
