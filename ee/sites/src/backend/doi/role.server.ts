import { SITE_DOI_CONFIG_MODE, SITE_DOI_CONFIG_STATUS } from '@curvenote/scms-core';
import {
  commitDoiWrite,
  dbDeleteDoiConfig,
  dbGetDoiConfig,
  dbSiteHasLiveRegistrations,
  isExpectedRow,
  dbUpdateDoiConfig,
} from './db.server.js';
import { DOI_ERRORS, STALE } from './errors.js';
import type { DoiActor, DoiDeps, DoiFailure, DoiResult } from './types.js';
import { ROLE_RE, lookupOwner, validateRole } from './validation.server.js';

const FORBIDDEN: DoiFailure = { ok: false, status: 403, error: DOI_ERRORS.forbidden };
const PAIR_TAKEN: DoiFailure = { ok: false, status: 409, error: DOI_ERRORS.pairTaken };
const HAS_REGISTRATIONS: DoiFailure = {
  ok: false,
  status: 409,
  error: DOI_ERRORS.hasRegistrations,
};

export type BindRoleInput = {
  siteId: string;
  actor: DoiActor;
  role: string;
  occ: number;
};

/**
 * The one manual step: a Curvenote system admin enters the role from the Crossref email.
 * Entering it is the authorization ("this prefix and role are this site's"), so the caller must
 * be a system admin, the role must authenticate, and the pair must be free.
 */
export async function bindRole(deps: DoiDeps, input: BindRoleInput): Promise<DoiResult> {
  if (!input.actor.isSystemAdmin) {
    return FORBIDDEN;
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
  const role = input.role.trim();
  // Format first so a typo costs no Crossref call; validateRole checks it again as its own guard.
  if (!ROLE_RE.test(role)) {
    return { ok: false, status: 400, error: DOI_ERRORS.roleFormat };
  }
  const owner = await lookupOwner(deps, existing.prefix);
  if (!owner.ok) {
    return owner;
  }
  const valid = await validateRole(deps, role);
  if (!valid.ok) {
    return valid;
  }
  // The only unique constraint this update can hit is the custom prefix/role pair.
  return commitDoiWrite(
    deps,
    { siteId: input.siteId, actor: input.actor, action: 'bind-role', onUnique: PAIR_TAKEN },
    (tx) =>
      dbUpdateDoiConfig(tx, existing, {
        role,
        prefix_owner: owner.ownerName,
        status: SITE_DOI_CONFIG_STATUS.ACTIVE,
      }),
  );
}

export type UnlinkRoleInput = {
  siteId: string;
  actor: DoiActor;
  occ: number;
};

/** Registered DOIs, or a registration in progress, block it for everyone. */
export async function unlinkRole(deps: DoiDeps, input: UnlinkRoleInput): Promise<DoiResult> {
  if (!input.actor.isSystemAdmin) {
    return FORBIDDEN;
  }
  const existing = await dbGetDoiConfig(deps.prisma, input.siteId);
  if (
    !isExpectedRow(existing, {
      occ: input.occ,
      mode: SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX,
      status: SITE_DOI_CONFIG_STATUS.ACTIVE,
    })
  ) {
    return STALE;
  }
  if (await dbSiteHasLiveRegistrations(deps.prisma, input.siteId)) {
    return HAS_REGISTRATIONS;
  }
  return commitDoiWrite(
    deps,
    { siteId: input.siteId, actor: input.actor, action: 'unlink-role', onUnique: STALE },
    (tx) =>
      dbUpdateDoiConfig(tx, existing, {
        role: null,
        status: SITE_DOI_CONFIG_STATUS.PENDING_ROLE,
      }),
  );
}

export type ResetConfigInput = {
  siteId: string;
  actor: DoiActor;
  occ: number;
};

/**
 * Back to "not configured". The only way to change mode or an ACTIVE prefix, so it is also how a
 * site admin undoes their own setup: the prefix they typed, or the method they picked.
 *
 * It stops being theirs once a Curvenote system admin has validated and linked a Crossref role:
 * that binding is our work and frees the prefix/role pair for other Sites, so only a system admin
 * can throw it away. Registered DOIs, or a registration in progress, block it for everyone.
 */
export async function resetConfig(deps: DoiDeps, input: ResetConfigInput): Promise<DoiResult> {
  const existing = await dbGetDoiConfig(deps.prisma, input.siteId);
  if (!isExpectedRow(existing, { occ: input.occ })) {
    return STALE;
  }
  const roleLinkedByCurvenote =
    existing.mode === SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX && existing.role !== null;
  if (roleLinkedByCurvenote && !input.actor.isSystemAdmin) {
    return FORBIDDEN;
  }
  if (await dbSiteHasLiveRegistrations(deps.prisma, input.siteId)) {
    return HAS_REGISTRATIONS;
  }
  return commitDoiWrite(
    deps,
    { siteId: input.siteId, actor: input.actor, action: 'reset', onUnique: STALE },
    async (tx) => {
      await dbDeleteDoiConfig(tx, existing);
      return null;
    },
  );
}
