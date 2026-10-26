// Local development / any host that wants a plain listening process.
import app from './index';
import { env } from './env';

app.listen(env.port, () => {
  console.log(`sync server listening on :${env.port}`);
});
