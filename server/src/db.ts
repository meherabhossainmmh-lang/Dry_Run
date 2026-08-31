import { PrismaClient } from '@prisma/client';

/**
 * Single shared Prisma client. Reused across requests — Prisma manages its
 * own connection pool internally, so we don't want a client per request.
 */
export const prisma = new PrismaClient();

