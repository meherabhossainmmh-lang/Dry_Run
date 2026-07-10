import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'meherabhossain.mmh@gmail.com';
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' }
  });
  console.log('User promoted to ADMIN:', user.email);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
