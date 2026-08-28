-- Add admin-recoverable password copy (demo feature: "view current password"
-- in the admin panel). Nullable so existing accounts keep working; it is
-- backfilled automatically on each user's next login or password reset.
ALTER TABLE "users" ADD COLUMN "passwordPlain" TEXT;
