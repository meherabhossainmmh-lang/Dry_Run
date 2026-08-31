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
  if (password) {
    data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    data.passwordPlain = password; // keep the admin-recoverable copy in sync
  }
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

/**
 * DELETE /api/admin/users/:id
 * Deletes a user account. Their saved events are kept but detached
 * (Event.userId is nullable with onDelete: SetNull), so the audit log
 * stays intact. An admin cannot delete their own account.
 */
router.delete('/users/:id', requireAuth, adminOnly, async (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  if (id === req.userId) {
    res.status(403).json({ error: 'Cannot delete your own account' });
    return;
  }
  try {
    const user = await prisma.user.delete({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isBlocked: true },
    });
    res.json({ user });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

/**
 * GET /api/admin/users/:id/events
 * Returns one user's saved command history, newest first (admin view).
 */
router.get('/users/:id/events', requireAuth, adminOnly, async (req, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const events = await prisma.event.findMany({
    where: { userId: id },
    orderBy: { id: 'desc' },
    take: 100,
  });
  res.json({ events });
});

/**
 * DELETE /api/admin/users/:id/events
 * Clears one user's saved command history (admin action).
 */
router.delete('/users/:id/events', requireAuth, adminOnly, async (req, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const result = await prisma.event.deleteMany({ where: { userId: id } });
  res.json({ deleted: result.count });
});

/**
 * GET /api/admin/users/:id/password
 * Returns the user's current (recoverable) password for the admin panel's
 * "view current password" tool. Admin-only.
 *
 * Accounts from before this column existed have no stored copy yet. Their
 * last sign-in was recorded in the old security log as
 * "Login attempt: <email> (pw: <password>)", so the first time an admin
 * opens one of those accounts we recover the password from that row and
 * save it. From then on it is kept in sync by register/login/set-password.
 */
router.get('/users/:id/password', requireAuth, adminOnly, async (req, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id }, select: { passwordPlain: true } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (user.passwordPlain != null) {
    res.json({ password: user.passwordPlain });
    return;
  }

  // legacy account: recover the password from the old security log, if this
  // user ever signed in while those rows were still being written
  const legacy = await prisma.event.findFirst({
    where: { userId: id, message: { contains: '(pw:' } },
    orderBy: { id: 'desc' },
  });
  const recovered = legacy?.message.match(/\(pw:\s*(.+)\)\s*$/);
  if (recovered) {
    await prisma.user.update({ where: { id }, data: { passwordPlain: recovered[1] } });
    res.json({ password: recovered[1] });
    return;
  }
  res.json({ password: null });
});

export default router;
