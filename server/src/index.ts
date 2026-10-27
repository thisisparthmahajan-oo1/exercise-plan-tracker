// Entry point for Vercel (zero-config Express: src/index.ts must import
// express and default-export the app). For a long-running local process, see
// src/local.ts.
import express from 'express';

import { configureApp } from './configureApp';
import { env } from './env';
import { getCollections } from './mongo';

const app = express();
configureApp(app, getCollections, env.jwtSecret);

export default app;
