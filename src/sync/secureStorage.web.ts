// Web has no Keychain (expo-secure-store is a no-op there), so the session
// lives in localStorage. It's a revocable, expiring session — never the
// APP_TOKEN — and rotating APP_TOKEN on the server invalidates it.
export const secureStorage = {
  get: async (key: string) => window.localStorage.getItem(key),
  set: async (key: string, value: string) => window.localStorage.setItem(key, value),
  remove: async (key: string) => window.localStorage.removeItem(key),
};
