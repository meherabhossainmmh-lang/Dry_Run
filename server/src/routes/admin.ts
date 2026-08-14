import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import type { Response, NextFunction } from 'express';

const router = Router();
const SALT_ROUNDS = 12;

/**
 * Middleware: only allows ADMIN roles through.
 */
async function adminOnly(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin privileges required' });
    return;
  }
  next();
}

/**
 * GET /api/admin/users
 * List all users.
 */
router.get('/users', requireAuth, adminOnly, async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, name: true, email: true, role: true, isBlocked: true, createdAt: true }
  });
  res.json({ users });
});

const updateSchema = z.object({
  password: z.string().min(8).optional(),
  isBlocked: z.boolean().optional(),
});

/**
 * PATCH /api/admin/users/:id
 * Block/Unblock or change password for a user.
 */
router.patch('/users/:id', requireAuth, adminOnly, async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { password, isBlocked } = parsed.data;
  const data: any = {};
  if (password) data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  if (isBlocked !== undefined) data.isBlocked = isBlocked;

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isBlocked: true }
    });
    res.json({ user });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

export default router;
