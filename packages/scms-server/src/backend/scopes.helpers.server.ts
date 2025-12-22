import type { SiteRole, WorkRole } from '@prisma/client';
import type { UserDBO, UserWithRolesDBO } from './db.types.js';
import { system } from '@curvenote/scms-core';
import {
  hasScopeViaSystemRole,
  hasSiteScope,
  hasWorkScope,
  getSystemRoleScopes,
  getSiteRoleScopes,
} from './roles.server.js';

/**
 * Return true if user exists and has specified scope on the site or
 * if they are a system admin
 *
 * Otherwise returns false.
 */
export function userHasSiteScope(
  user:
    | (UserDBO & { site_roles: { site_id: string; user_id: string; role: SiteRole }[] })
    | undefined,
  scope: string,
  siteId?: string,
): boolean {
  if (!user) return false;
  if (hasScopeViaSystemRole(user.system_role, system.admin)) return true;
  if (siteId) {
    const siteRoles = user.site_roles.filter((sr) => sr.site_id === siteId).map(({ role }) => role);
    const rolesWithScope = siteRoles.filter((siteRole) => hasSiteScope(siteRole, scope));

    return rolesWithScope.length > 0;
  }
  return false;
}

/**
 * ⚠️  IMPORTANT: Consider using userHasSiteScope or userHasWorkScope when specifically checking for site or work scopes
 *
 * Returns true if the user exists and has the specified scope, or if they are a system admin.
 *
 * Site-scoped behavior:
 * - If `scope` is of the form `site:...:SITE_NAME`, the check is performed against roles for `SITE_NAME`.
 * - If an optional `siteName` (aka `theSiteName`) is supplied, that is used and the scope is assumed to be a raw site scope e.g site:read or site:collections:list.
 *
 * Otherwise returns false.
 */
export function userHasScope(
  user: UserWithRolesDBO | undefined,
  scope: string,
  siteName?: string,
): boolean {
  if (!user) return false;
  // System admins can do anything
  if (hasScopeViaSystemRole(user.system_role, system.admin)) return true;
  // System roles may grant app-level scopes
  if (hasScopeViaSystemRole(user.system_role, scope)) return true;

  // Check for required scopes via the UserRole/Role assignment
  const userScopes = (user.roles || []).reduce((acc, r) => {
    // Defensively handle the scopes field - only add if it's an array of strings
    const scopes = r.role.scopes;
    if (Array.isArray(scopes) && scopes.every((s) => typeof s === 'string')) {
      return [...acc, ...scopes];
    }
    return acc;
  }, [] as string[]);

  if (userScopes.includes(scope)) return true;

  // FUTURE: This will move the access table and uniformly handle site/work/user scopes
  if (scope.startsWith('site:') && (user.site_roles ?? []).length > 0) {
    // Branch 1: explicit site override provided; `scope` is assumed to be a raw site scope
    if (siteName) {
      const siteRoles = user.site_roles
        .filter((sr) => sr.site.name === siteName)
        .map(({ role }) => role);
      if (siteRoles.length === 0) return false;

      const rolesWithScope = siteRoles.filter((siteRole) => hasSiteScope(siteRole, scope));
      return rolesWithScope.length > 0;
    }

    // Branch 2: infer site name from the scope and compute the raw scope
    const scopeParts = scope.split(':');
    const theSiteName = scopeParts[scopeParts.length - 1];
    if (!theSiteName) return false;

    const siteRoles = user.site_roles
      .filter((sr) => sr.site.name === theSiteName)
      .map(({ role }) => role);
    if (siteRoles.length === 0) return false;

    const rawScope = scope.split(':').slice(0, -1).join(':');
    const rolesWithScope = siteRoles.filter((siteRole) => hasSiteScope(siteRole, rawScope));
    return rolesWithScope.length > 0;
  }
  return false;
}

/**
 * Returns true only if the user has ALL of the requested scopes.
 *
 * For site-scoped checks, if `siteName` (aka `theSiteName`) is provided it will be used
 * as an override for the site parsed from each `site:*` scope string.
 */
export function userHasScopes(
  user: UserWithRolesDBO | undefined,
  scopes: string[],
  siteName?: string,
): boolean {
  return scopes.every((scope) => userHasScope(user, scope, siteName));
}

/**
 * Get a complete set of all user scopes, including system and site scopes, where
 * site scopes have been extended using the site name
 *
 * @param user
 * @returns
 */
export function getUserScopesSet(user: UserWithRolesDBO): Set<string> {
  const systemScopes = getSystemRoleScopes(user.system_role);
  const siteScopes = user.site_roles.flatMap((sr) => {
    return getSiteRoleScopes(sr.role).map((scope) => `${scope}:${sr.site.name}`);
  });
  return new Set([...systemScopes, ...siteScopes]);
}

/**
 * Return true if user exists and has specified scope on the work or
 * if they are a system admin.
 *
 * Otherwise returns false.
 */
export function userHasWorkScope(
  user:
    | (UserDBO & {
        work_roles: { work_id: string; user_id: string; role: WorkRole }[];
      })
    | undefined,
  scope: string,
  workId?: string | null,
): boolean {
  if (!user) return false;
  if (hasScopeViaSystemRole(user.system_role, system.admin)) return true;
  if (workId) {
    const workRoles = user.work_roles.filter((sr) => sr.work_id === workId).map(({ role }) => role);
    return !!workRoles.find((workRole) => hasWorkScope(workRole, scope));
  }
  return false;
}
