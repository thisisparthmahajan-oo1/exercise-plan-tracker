import { createApp } from './app';
import { env } from './env';
import { connect } from './mongo';

async function main() {
  const { cols } = await connect(env.mongoUri, env.mongoDb);
  createApp(cols, env.jwtSecret).listen(env.port, () => {
    console.log(`sync server listening on :${env.port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
