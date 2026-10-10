import type { SiteContext } from '@curvenote/scms-server';
import { getPrismaClient } from '@curvenote/scms-server';
import { Prisma } from '@curvenote/scms-db';
import type { InboxPeriod } from './inboxParams.js';
import { inboxPeriodStartIso } from './inboxParams.js';
import { formatInboxActivities } from './format.server.js';

const INBOX_ACTIVITY_SELECT = {
  id: true,
  date_created: true,
  activity_type: true,
  status: true,
  data: true,
  transition: true,
  activity_by: { select: { display_name: true } },
  submission: {
    select: {
      id: true,
      versions: {
        take: 1,
        orderBy: { date_created: 'desc' },
        select: {
          status: true,
          work_version: { select: { title: true } },
        },
      },
    },
  },
} satisfies Prisma.ActivitySelect;

export type InboxActivityRow = Prisma.ActivityGetPayload<{ select: typeof INBOX_ACTIVITY_SELECT }>;

export type InboxActivityItem = {
  id: string;
  date_created: string;
  activity_type: string;
  activity_by: { name: string };
  status?: string;
  data?: Record<string, unknown> | null;
  transition?: Record<string, unknown> | null;
  submission?: {
    id: string;
    title: string;
  };
};

export type InboxActivityPage = {
  items: InboxActivityItem[];
  hasMore: boolean;
};

/** `sv` has a json object `metadata.queue` with a non-empty trimmed `name`. */
function sqlSubmissionVersionHasQueueName(): Prisma.Sql {
  return Prisma.sql`
    jsonb_typeof(sv.metadata->'queue') = 'object'
    AND NULLIF(TRIM(sv.metadata->'queue'->>'name'), '') IS NOT NULL
  `;
}

/** Newest listed version for each submission (queue-aware queries). */
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

export type InboxHeadlineStats = {
  period: InboxPeriod;
  periodStart: string;
  newSubmissions: number;
  published: number;
  assignedInQueue: number;
};

export async function dbGetInboxHeadlineStats(
  ctx: SiteContext,
  period: InboxPeriod,
): Promise<InboxHeadlineStats> {
  const prisma = await getPrismaClient();
  const periodStart = inboxPeriodStartIso(period);

  const [newRow, publishedRow, assignedRow] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Submission" s
      WHERE s.site_id = ${ctx.site.id}
        AND s.date_created >= ${periodStart}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Submission" s
      WHERE s.site_id = ${ctx.site.id}
        AND s.is_listed = TRUE
        AND s.date_published IS NOT NULL
        AND s.date_published >= ${periodStart}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      ${sqlNewestListedVersionJoin(ctx.site.id)}
        AND ${sqlSubmissionVersionHasQueueName()}
        AND sv.date_created >= ${periodStart}
    `,
  ]);

  return {
    period,
    periodStart,
    newSubmissions: Number(newRow[0]?.count ?? 0),
    published: Number(publishedRow[0]?.count ?? 0),
    assignedInQueue: Number(assignedRow[0]?.count ?? 0),
  };
}

/** Latest submission-scoped activity for the site inbox feed. */
export async function dbListInboxActivities(
  ctx: SiteContext,
  { offset, limit }: { offset: number; limit: number },
): Promise<InboxActivityPage> {
  const prisma = await getPrismaClient();
  const rows = await prisma.activity.findMany({
    where: {
      submission_id: { not: null },
      submission: { site_id: ctx.site.id },
    },
    orderBy: { date_created: 'desc' },
    skip: offset,
    take: limit + 1,
    select: INBOX_ACTIVITY_SELECT,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: formatInboxActivities(page),
    hasMore,
  };
}
