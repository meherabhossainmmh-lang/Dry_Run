-- Repair migration: bring a database created from the committed migrations
-- up to the current schema. The role/isBlocked columns and the two event
-- indexes were added to the Prisma schema without a matching migration, so a
-- fresh `prisma migrate deploy` left the database incomplete and the server
-- failed on start-up queries ("The column `role` does not exist").
-- Every statement below is idempotent, so this also runs cleanly on databases
-- that already have the columns and indexes (they are simply skipped).

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "events_level_idx" ON "events"("level");
CREATE INDEX IF NOT EXISTS "events_source_idx" ON "events"("source");
