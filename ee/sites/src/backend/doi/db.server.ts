import { uuidv7 } from 'uuidv7';
import type { Prisma } from '@curvenote/scms-db';
import { ActivityType } from '@curvenote/scms-db';
import type { SiteDoiConfigMode, SiteDoiConfigStatus } from '@curvenote/scms-core';
import { writeSiteDoiConfigActivity } from './activity.server.js';
import { STALE } from './errors.js';
import type {
  DoiActor,
  DoiConfigRowData,
  DoiConfigSnapshot,
  DoiDeps,
  DoiFailure,
  DoiIntent,
  DoiResult,
  DoiTx,
  SiteDoiConfigDTO,
} from './types.js';

const SELECT = {
  id: true,
  site_id: true,
  mode: true,
  prefix: true,
  prefix_owner: true,
  role: true,
  status: true,
  attention_reason: true,
  occ: true,
} as const;

export type DoiConfigRow = Prisma.SiteDoiConfigGetPayload<{ select: typeof SELECT }>;
type Reader = Pick<DoiDeps['prisma'], 'siteDoiConfig'> | DoiTx;

export function toSnapshot(row: DoiConfigRow): DoiConfigSnapshot {
  const { mode, prefix, prefix_owner, role, status } = row;
  return { mode, prefix, prefix_owner, role, status };
}

export function toDTO(row: DoiConfigRow): SiteDoiConfigDTO {
  return { ...toSnapshot(row), attention_reason: row.attention_reason, occ: row.occ };
}

export function dbGetDoiConfig(client: Reader, siteId: string) {
  return client.siteDoiConfig.findUnique({ where: { site_id: siteId }, select: SELECT });
}

type ExpectedRow = { occ: number; mode?: SiteDoiConfigMode; status?: SiteDoiConfigStatus };

/** The row an intent may act on: it exists, the tab saw its current occ, and mode and status match. */
export function isExpectedRow(
  row: DoiConfigRow | null,
  expected: ExpectedRow,
): row is DoiConfigRow {
  return (
    row !== null &&
    row.occ === expected.occ &&
    (expected.mode === undefined || row.mode === expected.mode) &&
    (expected.status === undefined || row.status === expected.status)
  );
}

type CreateDoiConfigInput = {
  siteId: string;
  mode: SiteDoiConfigMode;
  prefix: string;
  prefixOwner: string | null;
  role: string | null;
  status: SiteDoiConfigStatus;
};

export function dbCreateDoiConfig(tx: DoiTx, input: CreateDoiConfigInput) {
  const timestamp = new Date().toISOString();
  return tx.siteDoiConfig.create({
    data: {
      id: uuidv7(),
      date_created: timestamp,
      date_modified: timestamp,
      site: { connect: { id: input.siteId } },
      mode: input.mode,
      prefix: input.prefix,
      prefix_owner: input.prefixOwner,
      role: input.role,
      status: input.status,
    },
    select: SELECT,
  });
}

/** `occ` in the `where` makes a stale tab fail with P2025 instead of overwriting. */
export function dbUpdateDoiConfig(
  tx: DoiTx,
  row: { id: string; occ: number },
  data: DoiConfigRowData,
) {
  return tx.siteDoiConfig.update({
    where: { id: row.id, occ: row.occ },
    data: { ...data, date_modified: new Date().toISOString(), occ: { increment: 1 } },
    select: SELECT,
  });
}

export function dbDeleteDoiConfig(tx: DoiTx, row: { id: string; occ: number }) {
  return tx.siteDoiConfig.delete({ where: { id: row.id, occ: row.occ }, select: { id: true } });
}

/** Who bound the role and when: the newest bind-role activity on the site. */
export async function dbGetRoleBoundBy(client: DoiDeps['prisma'], siteId: string) {
  const activity = await client.activity.findFirst({
    where: {
      site_id: siteId,
      activity_type: ActivityType.SITE_DOI_CONFIG_UPDATED,
      data: { path: ['action'], equals: 'bind-role' },
    },
    orderBy: { date_created: 'desc' },
    select: {
      date_created: true,
      activity_by: { select: { display_name: true, username: true } },
    },
  });
  if (!activity) {
    return undefined;
  }
  const { display_name, username } = activity.activity_by;
  return { name: display_name ?? username ?? 'Unknown user', date: activity.date_created };
}

type DoiWrite = {
  siteId: string;
  actor: DoiActor;
  action: DoiIntent;
  /** What a P2002 means for this write; see below. */
  onUnique: DoiFailure;
};

/**
 * Run a write and its SITE_DOI_CONFIG_UPDATED activity in one transaction, so every change is
 * logged with who made it. `fn` returns the row after the write, or null when it deleted it.
 *
 * The two expected Prisma errors become results. P2002 (unique violation) is mapped by the caller,
 * which knows the only unique constraint its write can hit: `site_id` on create, the custom
 * prefix/role pair on bind. We do not read `meta.target`, because the pair index is raw SQL that
 * Prisma's schema does not know. P2025 (no row matched `id` + `occ`) means another request changed
 * or removed the row.
 */
export async function commitDoiWrite(
  deps: DoiDeps,
  write: DoiWrite,
  fn: (tx: DoiTx) => Promise<DoiConfigRow | null>,
): Promise<DoiResult> {
  try {
    const row = await deps.prisma.$transaction(async (tx) => {
      const written = await fn(tx);
      await writeSiteDoiConfigActivity(tx, {
        siteId: write.siteId,
        userId: write.actor.userId,
        action: write.action,
        config: written ? toSnapshot(written) : null,
      });
      return written;
    });
    return { ok: true, config: row ? toDTO(row) : null };
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return write.onUnique;
    }
    if (e?.code === 'P2025') {
      return STALE;
    }
    throw e;
  }
}
