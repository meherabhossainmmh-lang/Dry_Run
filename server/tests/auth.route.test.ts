import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

// authRouter imports { prisma } from '../db.js' — replace it with a mock so
// these tests exercise real route/validation/hashing logic without needing
// a live Postgres instance.
vi.mock('../src/db.js', () => ({ prisma: mockPrisma }));

const { default: authRouter } = await import('../src/routes/auth.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/register', () => {
  it('400s on invalid input (bad email, short password) before touching the DB', async () => {
    const res = await request(buildApp())
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('409s on a duplicate email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'a@example.com' });

    const res = await request(buildApp())
      .post('/api/auth/register')
      .send({ name: 'A', email: 'a@example.com', password: 'longenough1' });

    expect(res.status).toBe(409);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('never persists or returns the plaintext password — only a bcrypt hash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, ...data, createdAt: new Date() }),
    );
    const plaintext = 'correct horse battery staple';

    const res = await request(buildApp())
      .post('/api/auth/register')
      .send({ name: 'A', email: 'a@example.com', password: plaintext });

    expect(res.status).toBe(201);

    const createArgs = mockPrisma.user.create.mock.calls[0][0];
    expect(createArgs.data.passwordHash).not.toBe(plaintext);
    expect(createArgs.data.passwordHash.startsWith('$2')).toBe(true); // bcrypt hash format
    expect(await bcrypt.compare(plaintext, createArgs.data.passwordHash)).toBe(true);

    // Response envelope must not leak the hash back to the client either.
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(plaintext);
    expect(typeof res.body.token).toBe('string');
  });
});

describe('POST /api/auth/login', () => {
  it('401s on an unknown email without revealing that the account does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
    expect(res.body.error.toLowerCase()).not.toContain('no such user');
    expect(res.body.error.toLowerCase()).not.toContain('not found');
  });

  it('401s on a correct email with the wrong password', async () => {
    const hash = await bcrypt.hash('correctpassword', 4); // low cost factor — speed only, still valid
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'A',
      email: 'a@example.com',
      passwordHash: hash,
      createdAt: new Date(),
    });

    const res = await request(buildApp())
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('200s with a usable token on correct credentials', async () => {
    const hash = await bcrypt.hash('correctpassword', 4);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      name: 'A',
      email: 'a@example.com',
      passwordHash: hash,
      createdAt: new Date(),
    });

    const res = await request(buildApp())
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'correctpassword' });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(5);
    expect(typeof res.body.token).toBe('string');
  });
});

describe('GET /api/auth/me', () => {
  it('401s with no token', async () => {
    const res = await request(buildApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
