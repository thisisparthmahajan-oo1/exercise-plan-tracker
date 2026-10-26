// Usage: npm run create-user -- <email> <password>
// There is no signup endpoint; accounts are created here.
import { randomUUID } from 'node:crypto';

import { hashPassword } from '../src/auth';
import { env } from '../src/env';
import { connect } from '../src/mongo';

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: npm run create-user -- <email> <password>');
    process.exit(1);
  }
  const { client, cols } = await connect(env.mongoUri, env.mongoDb);
  await cols.users.insertOne({
    _id: randomUUID(),
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    createdAt: new Date(),
  });
  console.log(`Created ${email.toLowerCase()}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
