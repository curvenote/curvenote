import { SITE_DOI_CONFIG_MODE, SITE_DOI_CONFIG_STATUS } from '@curvenote/scms-core';
import {
  commitDoiWrite,
  dbCreateDoiConfig,
  dbGetDoiConfig,
  isExpectedRow,
  dbUpdateDoiConfig,
} from './db.server.js';
import { DOI_ERRORS, STALE } from './errors.js';
import type { DoiActor, DoiDeps, DoiResult } from './types.js';
import { resolveCustomPrefix } from './validation.server.js';

export type ConfigureCurvenoteInput = {
  siteId: string;
  actor: DoiActor;
};

/** Curvenote-managed: our own prefix and role, nothing to verify, ACTIVE at once. */
export async function configureCurvenote(
  deps: DoiDeps,
  input: ConfigureCurvenoteInput,
): Promise<DoiResult> {
  if (await dbGetDoiConfig(deps.prisma, input.siteId)) {
    return STALE;
  }
  // The only unique constraint a create can hit is site_id: another tab configured first.
  return commitDoiWrite(
    deps,
    { siteId: input.siteId, actor: input.actor, action: 'configure-curvenote', onUnique: STALE },
    (tx) =>
      dbCreateDoiConfig(tx, {
        siteId: input.siteId,
        mode: SITE_DOI_CONFIG_MODE.CURVENOTE_PREFIX,
        prefix: deps.creds.prefix,
        prefixOwner: null,
        role: deps.creds.role,
        status: SITE_DOI_CONFIG_STATUS.ACTIVE,
      }),
  );
}

export type ConfigureCustomInput = {
  siteId: string;
  actor: DoiActor;
  customPrefixEnabled: boolean;
  prefix: string;
};

/** Own prefix: the customer enters the prefix only; the site waits for a system admin's role. */
export async function configureCustom(
  deps: DoiDeps,
  input: ConfigureCustomInput,
): Promise<DoiResult> {
  if (!input.customPrefixEnabled) {
    return { ok: false, status: 403, error: DOI_ERRORS.customDisabled };
  }
  if (await dbGetDoiConfig(deps.prisma, input.siteId)) {
    return STALE;
  }
  const resolved = await resolveCustomPrefix(deps, input.prefix);
  if (!resolved.ok) {
    return resolved;
  }
  return commitDoiWrite(
    deps,
    { siteId: input.siteId, actor: input.actor, action: 'configure-custom', onUnique: STALE },
    (tx) =>
      dbCreateDoiConfig(tx, {
        siteId: input.siteId,
        mode: SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX,
        prefix: resolved.prefix,
        prefixOwner: resolved.ownerName,
        role: null,
        status: SITE_DOI_CONFIG_STATUS.PENDING_ROLE,
      }),
  );
}

export type UpdatePrefixInput = {
  siteId: string;
  actor: DoiActor;
  customPrefixEnabled: boolean;
  prefix: string;
  occ: number;
};

/** The prefix can be corrected only while the site waits for its role. */
export async function updatePrefix(deps: DoiDeps, input: UpdatePrefixInput): Promise<DoiResult> {
  if (!input.customPrefixEnabled) {
    return { ok: false, status: 403, error: DOI_ERRORS.customDisabled };
  }
  const existing = await dbGetDoiConfig(deps.prisma, input.siteId);
  if (
    !isExpectedRow(existing, {
      occ: input.occ,
      mode: SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX,
      status: SITE_DOI_CONFIG_STATUS.PENDING_ROLE,
    })
  ) {
    return STALE;
  }
  const resolved = await resolveCustomPrefix(deps, input.prefix);
  if (!resolved.ok) {
    return resolved;
  }
  // role is null here, and NULLs never collide in the pair index, so a P2002 is not expected.
  return commitDoiWrite(
    deps,
    { siteId: input.siteId, actor: input.actor, action: 'update-prefix', onUnique: STALE },
    (tx) =>
      dbUpdateDoiConfig(tx, existing, {
        prefix: resolved.prefix,
        prefix_owner: resolved.ownerName,
      }),
  );
}
