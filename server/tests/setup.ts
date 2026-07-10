// Runs before every test file (see vitest.config.ts setupFiles). server/src/env.ts
// throws on import if DATABASE_URL / JWT_SECRET are unset, so these need to exist
// before anything under src/ is imported — none of these tests touch a real
// database, but the module-load-time guard in env.ts still needs to pass.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/dry_run_test?schema=public';
process.env.JWT_SECRET ??= 'test-only-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.PORT ??= '4001';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
