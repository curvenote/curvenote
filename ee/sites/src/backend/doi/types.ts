import type { Prisma } from '@curvenote/scms-db';
import type { getPrismaClient } from '@curvenote/scms-server';
import type { CrossrefCredentials } from '../crossref/client.server.js';

/** Form intents of the Site > DOI Registration action. Also the `action` stored on the activity. */
export const DOI_INTENTS = [
  'configure-curvenote',
  'configure-custom',
  'update-prefix',
  'bind-role',
  'unlink-role',
  'reset',
  'update-kind-mapping',
] as const;
export type DoiIntent = (typeof DOI_INTENTS)[number];

/** What the activity log keeps of a SiteDoiConfig row. */
export type DoiConfigSnapshot = {
  mode: string;
  prefix: string;
  prefix_owner: string | null;
  role: string | null;
  status: string;
};

/** What the screen needs. Forms post `occ` back so a stale tab is refused. */
export type SiteDoiConfigDTO = DoiConfigSnapshot & {
  occ: number;
};

/** The columns a DOI write may change. */
export type DoiConfigRowData = Partial<
  Pick<DoiConfigSnapshot, 'prefix' | 'prefix_owner' | 'role' | 'status'>
>;

export type DoiFailure = {
  ok: false;
  status: 400 | 403 | 409 | 502;
  error: string;
};

export type DoiResult = { ok: true; config: SiteDoiConfigDTO | null } | DoiFailure;

export type DoiDeps = {
  prisma: Awaited<ReturnType<typeof getPrismaClient>>;
  creds: CrossrefCredentials;
  fetch?: typeof fetch;
};
export type DoiActor = { userId: string; isSystemAdmin: boolean };
export type DoiTx = Prisma.TransactionClient;

/** What the activity log keeps of a kind whose DOI content type a write changed. */
export type KindMappingSnapshot = { id: string; name: string; doi_content_type: string | null };

/** One row of the Eligible Submission Kinds card. */
export type EligibleKindDTO = {
  id: string;
  title: string;
  doiContentType: string | null;
  /** DOIs were deposited, or are being deposited, as this kind's content type. */
  locked: boolean;
};
