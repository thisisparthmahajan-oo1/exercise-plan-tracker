// App entry. On native this is just expo-router's entry.
//
// On web, expo-sqlite runs SQLite in a Web Worker, and its *sync* API
// busy-waits on that worker with a short timeout. src/db/client.ts opens the
// database synchronously at import time, which would race the worker still
// downloading its script and compiling SQLite's WASM ("Sync operation
// timeout"). So on web we first open the database asynchronously — which
// waits for the worker to be up — and only then load the app.
//
// `require` (not `import()`) on purpose: the app stays in the main bundle and
// is merely *executed* later. A dynamic import would be split into a separate
// chunk, which the static web export fails to resolve.
import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';

function startApp() {
  require('expo-router/entry');
}

if (Platform.OS === 'web') {
  openDatabaseAsync('fitness.db', { enableChangeListener: true })
    .then((warm) => warm.closeAsync())
    .catch((e) => console.error('[db] web warm-up failed', e))
    .finally(startApp);
} else {
  startApp();
}
