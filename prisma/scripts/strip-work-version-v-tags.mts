/**
 * Remove vN-style tags (e.g. v1, v2) from WorkVersion.tags.
 * Submission versions keep their version tags; work versions should not.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx prisma/scripts/strip-work-version-v-tags.mts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.$executeRaw`
    UPDATE "WorkVersion" w
    SET tags = COALESCE(filtered.tags, '{}')
    FROM (
      SELECT
        id,
        array_agg(t ORDER BY ord) FILTER (WHERE t !~* '^v[0-9]+$') AS tags
      FROM "WorkVersion",
        unnest(tags) WITH ORDINALITY AS u(t, ord)
      GROUP BY id
    ) filtered
    WHERE w.id = filtered.id
      AND w.tags IS DISTINCT FROM COALESCE(filtered.tags, '{}')
  `;

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM "WorkVersion"
    WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE t ~* '^v[0-9]+$')
  `;

  console.log(`Updated ${updated} work version(s). Remaining vN tags on work versions: ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
