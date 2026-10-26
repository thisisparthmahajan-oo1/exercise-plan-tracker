import * as SecureStore from 'expo-secure-store';

// The server session, kept in the iOS Keychain rather than SQLite.
export type Credentials = { token: string; userId: string; email: string };

const KEY = 'sync.credentials';

export async function loadCredentials(): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Credentials) : null;
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(creds));
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
