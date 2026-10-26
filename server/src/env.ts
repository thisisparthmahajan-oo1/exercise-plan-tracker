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
  get jwtSecret() {
    return required('JWT_SECRET');
  },
  get port() {
    return Number(process.env.PORT ?? 8787);
  },
};
