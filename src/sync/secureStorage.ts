import * as SecureStore from 'expo-secure-store';

// Small key/value store for the sync session. Native: iOS Keychain.
// Web: see secureStorage.web.ts.
export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
