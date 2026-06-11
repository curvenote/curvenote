import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient } from '@curvenote/scms-server';
import { Prisma } from '@curvenote/scms-db';

/** `sv` has a json object `metadata.queue` with a non-empty trimmed `name`. */
function sqlSubmissionVersionHasQueueName(): Prisma.Sql {
  return Prisma.sql`
    jsonb_typeof(sv.metadata->'queue') = 'object'
    AND NULLIF(TRIM(sv.metadata->'queue'->>'name'), '') IS NOT NULL
  `;
}

function sqlNewestListedVersionJoin(siteId: string): Prisma.Sql {
  return Prisma.sql`
    FROM "Submission" s
    JOIN "SubmissionVersion" sv ON sv.submission_id = s.id
    WHERE s.site_id = ${siteId}
      AND s.is_listed = TRUE
      AND sv.id = (
        SELECT sv2.id
        FROM "SubmissionVersion" sv2
        WHERE sv2.submission_id = s.id
        ORDER BY sv2.date_created DESC
        LIMIT 1
      )
  `;
}

export type InboxQueueStats = {
  byQueue: Record<
    string,
    {
      count: number;
      oldestAt: string | null;
      maxAgeSeconds: number | null;
      staff: boolean;
    }
  >;
};

/** Per-queue totals and max time-in-queue for listed submissions on their newest version. */
export async function dbGetInboxQueueStats(ctx: SiteContext): Promise<InboxQueueStats> {
  const prisma = await getPrismaClient();
  const rows = await prisma.$queryRaw<
    { queue: string; staff: boolean; count: bigint; oldest_at: string | null }[]
  >`
    SELECT
      sv.metadata->'queue'->>'name' AS queue,
      bool_or(COALESCE((sv.metadata->'queue'->>'staff')::boolean, false)) AS staff,
      COUNT(*)::bigint AS count,
      MIN(sv.date_created) AS oldest_at
    ${sqlNewestListedVersionJoin(ctx.site.id)}
      AND ${sqlSubmissionVersionHasQueueName()}
    GROUP BY queue
    ORDER BY queue ASC
  `;

  const nowMs = Date.now();
  const byQueue: InboxQueueStats['byQueue'] = {};

  for (const row of rows) {
    const oldestAt = row.oldest_at;
    const maxAgeSeconds =
      oldestAt != null
        ? Math.max(0, Math.floor((nowMs - new Date(oldestAt).getTime()) / 1000))
        : null;

    byQueue[row.queue] = {
      count: Number(row.count),
      oldestAt,
      maxAgeSeconds,
      staff: row.staff,
    };
  }

  return { byQueue };
}
