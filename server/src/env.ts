function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

// Read on access, not at import, so modules can be imported (e.g. by tests)
// without a full environment.
export const env = {
  get mongoUri() {
    return required('MONGODB_URI');
  },
  get mongoDb() {
    return process.env.MONGODB_DB ?? 'fitness';
  },
  // The one access secret (see auth.ts). Required: without it the API would
  // be open to anyone.
  get appToken() {
    const token = required('APP_TOKEN');
    if (token.length < 24) throw new Error('APP_TOKEN must be at least 24 characters');
    return token;
  },
  get port() {
    return Number(process.env.PORT ?? 8787);
  },
};
