import type { SystemRole } from '@curvenote/scms-db';
import { SiteRole, WorkRole } from '@curvenote/scms-db';
import { site, work } from '@curvenote/scms-core';
import { getPrismaClient } from './prisma.server.js';
import { DEFAULT_SYSTEM_ROLE_SCOPES } from './systemRoleDefaults.js';

export const SCOPE_FORMAT_REGEX = /^[a-z]+(?::[a-z0-9-]+)+$/;

export function isValidScopeFormat(scope: string): boolean {
  return SCOPE_FORMAT_REGEX.test(scope);
}

function processScopes(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) return [];
  return scopes.filter((scope): scope is string => typeof scope === 'string');
}

export interface SystemRoleScopeConfig {
  role: SystemRole;
  scopes: string[];
  date_created: string | null;
  date_modified: string | null;
}

export async function getSystemRoleScopeConfig(role: SystemRole): Promise<SystemRoleScopeConfig> {
  const prisma = await getPrismaClient();
  const row = await prisma.systemRoleScope.findUnique({
    where: { role },
    select: {
      role: true,
      scopes: true,
      date_created: true,
      date_modified: true,
    },
  });
  if (!row) {
    return {
      role,
      scopes: getDefaultSystemRoleScopes(role),
      date_created: null,
      date_modified: null,
    };
  }
  return {
    role,
    scopes: processScopes(row.scopes),
    date_created: row.date_created,
    date_modified: row.date_modified,
  };
}

export function getDefaultSystemRoleScopes(role: SystemRole | null | undefined): string[] {
  if (role == null) return [];
  const scopes = DEFAULT_SYSTEM_ROLE_SCOPES[role];
  if (!Array.isArray(scopes)) return [];
  return [...scopes];
}

const SITE_ROLES: Record<SiteRole, Set<string>> = {
  [SiteRole.ADMIN]: new Set([
    site.list,
    site.read,
    site.update,
    site.details,
    site.analytics.read,
    site.analytics.list,
    site.domains.list,
    site.domains.create,
    site.domains.delete,
    site.domains.update,
    site.submissions.list,
    site.submissions.read,
    site.submissions.create,
    site.submissions.update,
    site.submissions.versions.create,
    site.submissions.delete,
    site.publishing,
    site.kinds.list,
    site.kinds.read,
    site.kinds.create,
    site.kinds.update,
    site.kinds.delete,
    site.collections.list,
    site.collections.read,
    site.collections.create,
    site.collections.update,
    site.collections.delete,
    site.users.list,
    site.users.read,
    site.users.update,
    site.users.delete,
    site.users.admin,
  ]),
  [SiteRole.EDITOR]: new Set([
    site.list,
    site.read,
    site.details,
    site.kinds.list,
    site.kinds.read,
    site.collections.list,
    site.collections.read,
    site.submissions.list,
    site.submissions.read,
    site.submissions.update,
    site.publishing,
    site.submissions.versions.create,
    site.users.list,
    site.users.read,
    site.users.update,
    site.users.delete,
  ]),
  [SiteRole.SUBMITTER]: new Set([
    site.list,
    site.read,
    site.details,
    site.kinds.list,
    site.kinds.read,
    site.collections.list,
    site.collections.read,
    site.submissions.list,
    site.submissions.read,
    site.submissions.create,
    site.submissions.versions.create,
  ]),
  [SiteRole.REVIEWER]: new Set([site.read]),
  [SiteRole.AUTHOR]: new Set([site.read]),
  [SiteRole.PUBLIC]: new Set([site.read]),
  [SiteRole.UNRESTRICTED]: new Set([
    site.read,
    site.kinds.list,
    site.kinds.read,
    site.collections.list,
    site.collections.read,
    site.submissions.create,
  ]),
};

const WORK_ROLES: Record<WorkRole, Set<string>> = {
  [WorkRole.OWNER]: new Set([
    work.read,
    work.update,
    work.submissions.list,
    work.submissions.read,
    work.submissions.create,
    work.submissions.update,
    work.submissions.versions.create,
    work.submissions.delete,
    work.users.read,
    work.users.update,
    work.checks.read,
    work.checks.dispatch,
  ]),
  [WorkRole.CONTRIBUTOR]: new Set([
    work.read,
    work.update,
    work.submissions.list,
    work.submissions.read,
    work.submissions.create,
    work.submissions.update,
    work.submissions.versions.create,
    work.users.read,
    work.checks.read,
  ]),
  [WorkRole.VIEWER]: new Set([work.read]),
};

export function hasDefaultScopeViaSystemRole(
  role: SystemRole | null | undefined,
  scope: string,
): boolean {
  return getDefaultSystemRoleScopes(role).includes(scope);
}

export function hasSiteScope(role: SiteRole, scope: string): boolean {
  const s = scope;
  const has = SITE_ROLES[role]?.has(s) ?? false;
  return has;
}

export function hasWorkScope(role: WorkRole, scope: string): boolean {
  const s = scope;
  const has = WORK_ROLES[role]?.has(s) ?? false;
  return has;
}

export function getSystemRoleScopes(role: SystemRole): string[] {
  return getDefaultSystemRoleScopes(role);
}

export function getSiteRoleScopes(role: SiteRole): string[] {
  return Array.from(SITE_ROLES[role]);
}

export function getWorkRoleScopes(role: WorkRole): string[] {
  return Array.from(WORK_ROLES[role]);
}
