function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const env = {
  mongoUri: required('MONGODB_URI'),
  mongoDb: process.env.MONGODB_DB ?? 'fitness',
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT ?? 8787),
};
