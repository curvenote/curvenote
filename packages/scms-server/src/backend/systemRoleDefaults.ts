import { SystemRole } from '@curvenote/scms-db';
import { app, system, work } from '@curvenote/scms-core';

/** Default system-level scopes for normal and site-scoped machine (SERVICE) users. */
const DEFAULT_USER_SYSTEM_SCOPES = [
  // work.create,
  work.list,
  app.works.feature,
  app.sites.feature,
  app.sites.request,
  app.dashboard.feature,
  app.settings.feature,
  app.settings.linkedAccounts.read,
  app.settings.linkedAccounts.manage,
  app.settings.tokens.read,
  app.settings.tokens.manage,
  app.settings.emails.read,
  app.settings.emails.update,
  app.settings.account.read,
  app.settings.account.update,
] as const;

/** Machine users excluded from people search and similar human-facing listings. */
export const MACHINE_SYSTEM_ROLES: readonly SystemRole[] = [
  SystemRole.SERVICE,
  SystemRole.SYSTEM_SERVICE,
];

export const DEFAULT_SYSTEM_ROLE_SCOPES: Record<SystemRole, string[]> = {
  [SystemRole.SYSTEM_SERVICE]: [system.admin],
  [SystemRole.SERVICE]: [...DEFAULT_USER_SYSTEM_SCOPES],
  [SystemRole.ADMIN]: [system.admin],
  [SystemRole.USER]: [...DEFAULT_USER_SYSTEM_SCOPES],
  [SystemRole.ANON]: [],
};
