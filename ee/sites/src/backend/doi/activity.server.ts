import { uuidv7 } from 'uuidv7';
import { ActivityType } from '@curvenote/scms-db';
import type { DoiConfigSnapshot, DoiIntent, DoiTx, KindMappingSnapshot } from './types.js';

type SiteDoiConfigActivityInput = {
  siteId: string;
  userId: string;
  action: DoiIntent;
  config: DoiConfigSnapshot | null;
  kinds?: KindMappingSnapshot[];
};

/**
 * One SITE_DOI_CONFIG_UPDATED activity per write, in the same transaction as the write.
 * `activity_by` and `date_created` are the record of who bound a role and when.
 *
 * `data` follows the tags precedent (`{ action, tag }` in scms-server `tags/assign.server.ts`):
 *   { action: DoiIntent, config: DoiConfigSnapshot | null, kinds?: KindMappingSnapshot[] }
 * `config` is the row after the write, and null after `reset`. `kinds` is on update-kind-mapping
 * only: the kinds it changed, with their new value.
 */
export async function writeSiteDoiConfigActivity(tx: DoiTx, input: SiteDoiConfigActivityInput) {
  const timestamp = new Date().toISOString();
  await tx.activity.create({
    data: {
      id: uuidv7(),
      date_created: timestamp,
      date_modified: timestamp,
      activity_by: { connect: { id: input.userId } },
      site: { connect: { id: input.siteId } },
      activity_type: ActivityType.SITE_DOI_CONFIG_UPDATED,
      data: {
        action: input.action,
        config: input.config,
        ...(input.kinds ? { kinds: input.kinds } : {}),
      },
    },
    select: { id: true },
  });
}
