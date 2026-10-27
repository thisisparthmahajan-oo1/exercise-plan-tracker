// App entry. On native this is just expo-router's entry.
//
// On web, expo-sqlite runs SQLite in a Web Worker, and its *sync* API
// busy-waits on that worker with a short timeout. src/db/client.ts opens the
// database synchronously at import time, which would race the worker still
// downloading its script and compiling SQLite's WASM ("Sync operation
// timeout"). So on web we first open the database asynchronously — which
// waits for the worker to be up — and only then load the app.
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  void import('expo-sqlite')
    .then((SQLite) => SQLite.openDatabaseAsync('fitness.db', { enableChangeListener: true }))
    .then((warm) => warm.closeAsync())
    .catch((e) => console.error('[db] web warm-up failed', e))
    .then(() => import('expo-router/entry'));
} else {
  require('expo-router/entry');
}
