import { SITE_DOI_CONFIG_MODE, SITE_DOI_CONFIG_STATUS } from '@curvenote/scms-core';
import { writeSiteDoiConfigActivity } from './activity.server.js';
import {
  commitDoiWrite,
  dbDeleteDoiConfig,
  dbGetDoiConfig,
  dbUpdateDoiConfig,
  toSnapshot,
} from './db.server.js';
import { DOI_ERRORS } from './errors.js';
import type { DoiActor, DoiDeps, DoiFailure, DoiResult } from './types.js';
import { ROLE_RE, lookupOwner, validateRole } from './validation.server.js';

const STALE: DoiFailure = { ok: false, status: 409, error: DOI_ERRORS.stale };
const FORBIDDEN: DoiFailure = { ok: false, status: 403, error: DOI_ERRORS.forbidden };
const PAIR_TAKEN: DoiFailure = { ok: false, status: 409, error: DOI_ERRORS.pairTaken };

/**
 * Unlinking a role or resetting the setup is allowed only while the site has no registered DOIs.
 * Phase 1 has no DoiRegistration model, so nothing can be registered and this always passes.
 * CN-2518 adds the model and fills this in. Do not delete it as dead code.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function assertNoRegisteredDois(deps: DoiDeps, siteId: string): Promise<DoiFailure | null> {
  return null;
}

export type BindRoleInput = {
  siteId: string;
  actor: DoiActor;
  role: string;
  occ: number;
};

/**
 * The one manual step: a Curvenote system admin enters the role from the Crossref email.
 * Entering it is the authorisation ("this prefix and role are this site's"), so the caller must
 * be a system admin, the role must authenticate, and the pair must be free.
 */
export async function bindRole(deps: DoiDeps, input: BindRoleInput): Promise<DoiResult> {
  if (!input.actor.isSystemAdmin) {
    return FORBIDDEN;
  }
  const existing = await dbGetDoiConfig(deps.prisma, input.siteId);
  if (
    !existing ||
    existing.mode !== SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX ||
    existing.status !== SITE_DOI_CONFIG_STATUS.PENDING_ROLE ||
    existing.occ !== input.occ
  ) {
    return STALE;
  }
  const role = input.role.trim();
  // Format first so a typo costs no Crossref call; validateRole checks it again as its own guard.
  if (!ROLE_RE.test(role)) {
    return { ok: false, status: 400, error: DOI_ERRORS.roleFormat, field: 'role' };
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
  return commitDoiWrite(deps, PAIR_TAKEN, async (tx) => {
    const updated = await dbUpdateDoiConfig(tx, existing, {
      role,
      prefix_owner: owner.ownerName,
      status: SITE_DOI_CONFIG_STATUS.ACTIVE,
    });
    await writeSiteDoiConfigActivity(tx, {
      siteId: input.siteId,
      userId: input.actor.userId,
      action: 'bind-role',
      config: toSnapshot(updated),
    });
    return updated;
  });
}

export type UnlinkRoleInput = {
  siteId: string;
  actor: DoiActor;
  occ: number;
};

export async function unlinkRole(deps: DoiDeps, input: UnlinkRoleInput): Promise<DoiResult> {
  if (!input.actor.isSystemAdmin) {
    return FORBIDDEN;
  }
  const existing = await dbGetDoiConfig(deps.prisma, input.siteId);
  if (
    !existing ||
    existing.mode !== SITE_DOI_CONFIG_MODE.CUSTOM_PREFIX ||
    existing.status !== SITE_DOI_CONFIG_STATUS.ACTIVE ||
    existing.occ !== input.occ
  ) {
    return STALE;
  }
  const blocked = await assertNoRegisteredDois(deps, input.siteId);
  if (blocked) {
    return blocked;
  }
  return commitDoiWrite(deps, STALE, async (tx) => {
    const updated = await dbUpdateDoiConfig(tx, existing, {
      role: null,
      status: SITE_DOI_CONFIG_STATUS.PENDING_ROLE,
    });
    await writeSiteDoiConfigActivity(tx, {
      siteId: input.siteId,
      userId: input.actor.userId,
      action: 'unlink-role',
      config: toSnapshot(updated),
    });
    return updated;
  });
}

export type ResetConfigInput = {
  siteId: string;
  actor: DoiActor;
  occ: number;
};

/** Back to "not configured". The only way to change mode or an ACTIVE prefix. */
export async function resetConfig(deps: DoiDeps, input: ResetConfigInput): Promise<DoiResult> {
  if (!input.actor.isSystemAdmin) {
    return FORBIDDEN;
  }
  const existing = await dbGetDoiConfig(deps.prisma, input.siteId);
  if (!existing || existing.occ !== input.occ) {
    return STALE;
  }
  const blocked = await assertNoRegisteredDois(deps, input.siteId);
  if (blocked) {
    return blocked;
  }
  return commitDoiWrite(deps, STALE, async (tx) => {
    await dbDeleteDoiConfig(tx, existing);
    await writeSiteDoiConfigActivity(tx, {
      siteId: input.siteId,
      userId: input.actor.userId,
      action: 'reset',
      config: null,
    });
    return null;
  });
}
