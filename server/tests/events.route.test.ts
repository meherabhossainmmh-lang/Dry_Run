import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockPrisma = {
  event: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('../src/db.js', () => ({ prisma: mockPrisma }));

const { default: eventsRouter } = await import('../src/routes/events.js');
const { signToken } = await import('../src/auth/jwt.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/events', eventsRouter);
  return app;
}

function fakeRow(id: number) {
  return { id, userId: null, source: 'voice', type: null, message: `m${id}`, level: 'info', createdAt: new Date() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/events', () => {
  it('400s on invalid input', async () => {
    const res = await request(buildApp()).post('/api/events').send({ message: '' });
    expect(res.status).toBe(400);
    expect(mockPrisma.event.create).not.toHaveBeenCalled();
  });

  it('files a guest event with userId: null when no token is sent', async () => {
    mockPrisma.event.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, ...data, createdAt: new Date() }),
    );

    const res = await request(buildApp())
      .post('/api/events')
      .send({ source: 'voice', message: 'home', level: 'info' });

    expect(res.status).toBe(201);
    expect(mockPrisma.event.create.mock.calls[0][0].data.userId).toBeNull();
  });

  it('files an authenticated event under the token\u2019s user id', async () => {
    mockPrisma.event.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 2, ...data, createdAt: new Date() }),
    );
    const token = signToken({ sub: 9, email: 'a@example.com' });

    const res = await request(buildApp())
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'voice', message: 'home', level: 'info' });

    expect(res.status).toBe(201);
    expect(mockPrisma.event.create.mock.calls[0][0].data.userId).toBe(9);
  });

  it('proceeds as a guest (does not 401) when the token is invalid', async () => {
    mockPrisma.event.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 3, ...data, createdAt: new Date() }),
    );

    const res = await request(buildApp())
      .post('/api/events')
      .set('Authorization', 'Bearer garbage')
      .send({ source: 'voice', message: 'home', level: 'info' });

    expect(res.status).toBe(201);
    expect(mockPrisma.event.create.mock.calls[0][0].data.userId).toBeNull();
  });
});

describe('GET /api/events — cursor pagination', () => {
  it('returns nextCursor (the last row id) when more rows exist than the page limit', async () => {
    // limit=2 -> route asks Prisma for 3 (limit + 1) to detect a next page.
    mockPrisma.event.findMany.mockResolvedValue([fakeRow(103), fakeRow(102), fakeRow(101)]);

    const res = await request(buildApp()).get('/api/events?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events.map((e: { id: number }) => e.id)).toEqual([103, 102]);
    expect(res.body.nextCursor).toBe(102);
  });

  it('returns nextCursor: null when the page is not full (last page)', async () => {
    mockPrisma.event.findMany.mockResolvedValue([fakeRow(1)]);

    const res = await request(buildApp()).get('/api/events?limit=10');

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.nextCursor).toBeNull();
  });

  it('translates ?cursor= into a Prisma keyset (cursor + skip:1)', async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);

    await request(buildApp()).get('/api/events?cursor=42');

    const args = mockPrisma.event.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: 42 });
    expect(args.skip).toBe(1);
  });

  it('400s on a malformed limit instead of silently falling back', async () => {
    const res = await request(buildApp()).get('/api/events?limit=not-a-number');
    expect(res.status).toBe(400);
    expect(mockPrisma.event.findMany).not.toHaveBeenCalled();
  });

  it('caps limit at 200 even if a larger value is requested', async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);

    const res = await request(buildApp()).get('/api/events?limit=5000');

    expect(res.status).toBe(400); // z.coerce.number().max(200) rejects out-of-range rather than clamping
  });

  it('scopes the query to userId: null for an unauthenticated caller', async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);

    await request(buildApp()).get('/api/events');

    expect(mockPrisma.event.findMany.mock.calls[0][0].where.userId).toBeNull();
  });

  it('scopes the query to the caller\u2019s own userId when authenticated', async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    const token = signToken({ sub: 12, email: 'a@example.com' });

    await request(buildApp()).get('/api/events').set('Authorization', `Bearer ${token}`);

    expect(mockPrisma.event.findMany.mock.calls[0][0].where.userId).toBe(12);
  });
});
