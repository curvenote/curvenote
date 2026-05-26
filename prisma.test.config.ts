import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 configuration for the **test database**.
 *
 * Identical to `prisma.config.ts` except `migrations.seed` is wired to the
 * test seed instead of the dev seed. This exists because Prisma 7 removed
 * `--skip-seed` from `prisma migrate reset` — there is no CLI override, so
 * the path is to point Prisma at a different config when running against
 * `.env.test`.
 *
 * Used by `test:db:reset` / `test:integration` in both the root and
 * `platform/scms` package.json scripts.
 */
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/schema/migrations',
    seed: 'npx tsx ./prisma/seed.test.mts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
