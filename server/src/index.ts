// Entry point for Vercel (zero-config Express: a default-exported app in
// src/index.ts). For a long-running local process, see src/local.ts.
import { createApp } from './createApp';
import { env } from './env';
import { getCollections } from './mongo';

export default createApp(getCollections, env.jwtSecret);
