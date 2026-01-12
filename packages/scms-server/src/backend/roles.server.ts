import { SiteRole, SystemRole, WorkRole } from '@prisma/client';
import { system, site, work, app } from '@curvenote/scms-core';

const SYSTEM_ROLES: Record<SystemRole, Set<string>> = {
  [SystemRole.SERVICE]: new Set([system.admin]), // in future service accounts will have limited scope, that's the whole point
  [SystemRole.ADMIN]: new Set([system.admin]),
  [SystemRole.PLATFORM_ADMIN]: new Set([app.platform.admin]),
  [SystemRole.USER]: new Set([work.create, work.list]),
  [SystemRole.ANON]: new Set([]),
};

const SITE_ROLES: Record<SiteRole, Set<string>> = {
  [SiteRole.ADMIN]: new Set([
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

export function hasScopeViaSystemRole(role: SystemRole, scope: string): boolean {
  return SYSTEM_ROLES[role]?.has(scope) ?? false;
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
  return Array.from(SYSTEM_ROLES[role]);
}

export function getSiteRoleScopes(role: SiteRole): string[] {
  return Array.from(SITE_ROLES[role]);
}

export function getWorkRoleScopes(role: WorkRole): string[] {
  return Array.from(WORK_ROLES[role]);
}
