import { SystemRole } from '@curvenote/scms-db';
import { app, system, work } from '@curvenote/scms-core';

export const DEFAULT_SYSTEM_ROLE_SCOPES: Record<SystemRole, string[]> = {
  [SystemRole.SERVICE]: [system.admin], // in future service accounts will have limited scope, that's the whole point
  [SystemRole.ADMIN]: [system.admin],
  [SystemRole.USER]: [
    work.create,
    work.list,
    app.works.upload,
    app.dashboard.read,
    app.sites.read,
    app.sites.request,
    app.settings.read,
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
