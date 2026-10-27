import * as SecureStore from 'expo-secure-store';

// The device session (never the APP_TOKEN itself), kept in the iOS Keychain
// rather than SQLite.
export type Credentials = { session: string; expiresAt: number };

const KEY = 'sync.session';

export async function loadCredentials(): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  const creds = JSON.parse(raw) as Credentials;
  return creds.expiresAt > Date.now() ? creds : null;
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(creds));
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
