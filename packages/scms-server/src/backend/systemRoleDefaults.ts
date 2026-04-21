import { SystemRole } from '@curvenote/scms-db';
import { app, system, work } from '@curvenote/scms-core';

export const DEFAULT_SYSTEM_ROLE_SCOPES: Record<SystemRole, string[]> = {
  [SystemRole.SERVICE]: [system.admin], // in future service accounts will have limited scope, that's the whole point
  [SystemRole.ADMIN]: [system.admin],
  [SystemRole.USER]: [
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
  ],
  [SystemRole.ANON]: [],
};
