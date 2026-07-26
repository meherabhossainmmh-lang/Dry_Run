import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import authRouter from './routes/auth.js';
import eventsRouter from './routes/events.js';
import adminRouter from './routes/admin.js';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dry-run-server' });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/admin', adminRouter);

// Centralized error handler — keeps route handlers free of try/catch
// boilerplate for unexpected (non-validation) failures.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.PORT, () => {
  console.log(`Dry Run server listening on http://localhost:${env.PORT}`);
});
