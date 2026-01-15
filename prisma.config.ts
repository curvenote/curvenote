import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 configuration file
 *
 * This file configures Prisma for the monorepo. The schema is located at
 * prisma/schema/ and the generated client is output to packages/scms-db/src/generated
 */
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/schema/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
