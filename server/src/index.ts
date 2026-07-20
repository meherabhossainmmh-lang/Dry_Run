import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import authRouter from './routes/auth.js';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dry-run-server' });
});

app.use('/api/auth', authRouter);

app.listen(env.PORT, () => {
  console.log(`Dry Run server listening on http://localhost:${env.PORT}`);
});
