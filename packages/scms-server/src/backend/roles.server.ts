import { $Enums } from '@curvenote/scms-db';
import { system, site, work, app } from '@curvenote/scms-core';

const SYSTEM_ROLES: Record<$Enums.SystemRole, Set<string>> = {
  [$Enums.SystemRole.SERVICE]: new Set([system.admin]), // in future service accounts will have limited scope, that's the whole point
  [$Enums.SystemRole.ADMIN]: new Set([system.admin]),
  [$Enums.SystemRole.PLATFORM_ADMIN]: new Set([app.platform.admin]),
  [$Enums.SystemRole.USER]: new Set([work.create, work.list]),
  [$Enums.SystemRole.ANON]: new Set([]),
};

const SITE_ROLES: Record<$Enums.SiteRole, Set<string>> = {
  [$Enums.SiteRole.ADMIN]: new Set([
    site.list,
    site.read,
    site.update,
    site.details,
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
  ]),
  [$Enums.SiteRole.EDITOR]: new Set([
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
  ]),
  [$Enums.SiteRole.SUBMITTER]: new Set([
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
  [$Enums.SiteRole.REVIEWER]: new Set([site.read]),
  [$Enums.SiteRole.AUTHOR]: new Set([site.read]),
  [$Enums.SiteRole.PUBLIC]: new Set([site.read]),
  [$Enums.SiteRole.UNRESTRICTED]: new Set([
    site.read,
    site.kinds.list,
    site.kinds.read,
    site.collections.list,
    site.collections.read,
    site.submissions.create,
  ]),
};

const WORK_ROLES: Record<$Enums.WorkRole, Set<string>> = {
  [$Enums.WorkRole.OWNER]: new Set([
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
  [$Enums.WorkRole.CONTRIBUTOR]: new Set([
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
  [$Enums.WorkRole.VIEWER]: new Set([work.read]),
};

export function hasScopeViaSystemRole(role: $Enums.SystemRole, scope: string): boolean {
  return SYSTEM_ROLES[role]?.has(scope) ?? false;
}

export function hasSiteScope(role: $Enums.SiteRole, scope: string): boolean {
  const s = scope;
  const has = SITE_ROLES[role]?.has(s) ?? false;
  return has;
}

export function hasWorkScope(role: $Enums.WorkRole, scope: string): boolean {
  const s = scope;
  const has = WORK_ROLES[role]?.has(s) ?? false;
  return has;
}

export function getSystemRoleScopes(role: $Enums.SystemRole): string[] {
  return Array.from(SYSTEM_ROLES[role]);
}

export function getSiteRoleScopes(role: $Enums.SiteRole): string[] {
  return Array.from(SITE_ROLES[role]);
}

export function getWorkRoleScopes(role: $Enums.WorkRole): string[] {
  return Array.from(WORK_ROLES[role]);
}
