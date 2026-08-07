import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../db.js';
import { signToken } from '../auth/jwt.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 12;

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().refine(e => e.endsWith('@gmail.com'), {
    message: 'Only Gmail addresses (@gmail.com) are allowed'
  }),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
  isAdminLogin: z.boolean().default(false),
});

function publicUser(u: any) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isBlocked: u.isBlocked, createdAt: u.createdAt };
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Account already exists' });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });

  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  
  const { email, password, isAdminLogin } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (isAdminLogin && user.role !== 'ADMIN') return res.status(403).json({ error: 'Use Admin portal' });
  if (!isAdminLogin && user.role === 'ADMIN') return res.status(403).json({ error: 'Use Admin portal' });
  if (user.isBlocked) return res.status(403).json({ error: 'Account blocked' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ token: signToken({ sub: user.id, email: user.email }), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

export default router;
