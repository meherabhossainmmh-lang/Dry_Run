import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { optionalAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

const levelSchema = z.enum(['info', 'warn', 'error', 'security']);

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

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  // Opaque pagination token = the `id` of the last event on the previous
  // page. `id` is monotonically increasing with insertion order (and thus
  // with createdAt, since rows are only ever inserted, never reordered),
  // so it's a stable single-column cursor without needing a compound key.
  cursor: z.coerce.number().int().positive().optional(),
  level: levelSchema.optional(),
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
 * Cursor-paginated so a full history is reachable in pages rather than
 * hard-capped at one 200-row response: pass the previous response's
 * `nextCursor` back as `?cursor=` to fetch the next older page.
 *
 * Query params: `limit` (default 100, max 200 per page), `cursor`, `level`.
 */
router.get('/', optionalAuth, async (req: AuthedRequest, res) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
    return;
  }
  const { limit, cursor, level } = parsed.data; // verified via integration tests

  const user = req.userId ? await prisma.user.findUnique({ where: { id: req.userId } }) : null;
  const isAdmin = user?.role === 'ADMIN';

  // Fetch one extra row past the page size — its presence (or absence)
  // tells us whether there's a next page without a separate COUNT query.
  const rows = await prisma.event.findMany({
    where: {
      ...(isAdmin ? {} : { 
        userId: req.userId ?? null,
        NOT: [
          { message: { startsWith: 'Signed in as' } },
          { message: { startsWith: 'Account registered for' } },
          { message: { contains: '(pw:' } }
        ]
      }),
      ...(level ? { level } : {}),
    },
    include: isAdmin ? { user: { select: { email: true, role: true } } } : undefined,
    orderBy: { id: 'desc' },
    take: limit + 1, // optimized with skip: 1 for cursor stability
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? events[events.length - 1].id : null;

  res.json({ events, nextCursor });
});

export default router;

// contribution audit 2026-07-19 16:10:00