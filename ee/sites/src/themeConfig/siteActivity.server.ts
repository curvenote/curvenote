import { getPrismaClient } from '@curvenote/scms-server';
import type { SiteContext } from '@curvenote/scms-server';
import type { ActivityType, Prisma } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';

/**
 * Record a site-level change on the site's activity log: who, what, when, and a small `data`
 * payload saying what changed (field names and counts — never the values, never PII).
 *
 * Analytics (`ctx.trackEvent`) tells us how the product is used; this is the audit trail a
 * site admin or a platform admin can be shown.
 */
export async function logSiteActivity(
  ctx: SiteContext,
  activityType: ActivityType,
  data?: Record<string, unknown>,
) {
  // Every caller runs behind `withAppSiteContext`, so a missing user is a programming error
  if (!ctx.user) throw new Error('logSiteActivity: no user on the site context');
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();
  await prisma.activity.create({
    data: {
      id: uuidv7(),
      date_created: now,
      date_modified: now,
      activity_by: { connect: { id: ctx.user.id } },
      site: { connect: { id: ctx.site.id } },
      activity_type: activityType,
      data: data as Prisma.InputJsonValue | undefined,
    },
    select: { id: true },
  });
}
