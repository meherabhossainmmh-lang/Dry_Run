// Default admin seeder for the Dry Run backend.
// Idempotent: creates the default admin if missing, or resets its password/role if present.
// Run from the server/ directory AFTER `npx prisma migrate dev`:
//     node prisma/seed.js
//
// Default admin credentials are the constants below — change them for any real deployment.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---- default admin account (configured here) ----
const ADMIN_NAME = 'Meherab';
const ADMIN_EMAIL = 'meherabhossain.mmh@gmail.com';
const ADMIN_PASSWORD = 'Admin@12345';
// -------------------------------------------------

const SALT_ROUNDS = 12; // must match auth.ts / admin.ts

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, role: 'ADMIN', isBlocked: false },
    create: { name: ADMIN_NAME, email: ADMIN_EMAIL, passwordHash, role: 'ADMIN' },
  });
  console.log(`Default admin ready -> email: ${user.email} | role: ${user.role}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
