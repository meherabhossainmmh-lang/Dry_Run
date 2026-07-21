import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { optionalAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

const levelSchema = z.enum(['info', 'warn', 'error']);

const createEventSchema = z.object({
  source: z.string().trim().min(1).max(40),
  type: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1).max(2000),
  level: levelSchema.default('info'),
});

/**
 * POST /api/events
 * Persists one entry from the pipeline event feed (src/state/store.ts
 * `log()`). Every source — dashboard, joystick, keyboard, voice, agent,
 * autonomous PIN runner — already funnels through that single `log()`
 * call, so this endpoint mirrors the same "one gate, one log" shape rather
 * than inventing a second contract. Works for both guest and registered
 * operators; `userId` is attached only when a valid token is present.
 */
router.post('/', optionalAuth, async (req: AuthedRequest, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { source, type, message, level } = parsed.data;

  const event = await prisma.event.create({
    data: {
      source,
      type,
      message,
      level,
      userId: req.userId ?? null,
    },
  });

  res.status(201).json({ event });
});

/**
 * GET /api/events
 * - Registered operators (Bearer token present): returns their own saved
 *   command history — this is what powers the "View My Saved Command
 *   History" use case.
 * - No token: returns the most recent anonymous/guest events only, capped
 *   and read-only, so the endpoint stays usable for a quick smoke test
 *   without leaking other operators' history.
 *
 * Optional query params: `limit` (default 100, max 200), `level`.
 */
router.get('/', optionalAuth, async (req: AuthedRequest, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200);
  const level = typeof req.query.level === 'string' ? req.query.level : undefined;

  const events = await prisma.event.findMany({
    where: {
      userId: req.userId ?? null,
      ...(level ? { level } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json({ events });
});

export default router;
