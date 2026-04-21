import type { ServerSideMenuContents } from '@curvenote/scms-core';
import { scopes } from '@curvenote/scms-core';

export function buildMenu(basePath: string, userScopes: string[]): ServerSideMenuContents {
  const hasScope = (scope: string) =>
    userScopes.includes(scope) || userScopes.includes(scopes.system.admin);

  const menus: ServerSideMenuContents[number]['menus'] = [];

  if (hasScope(scopes.app.settings.account.read)) {
    menus.push({
      name: 'settings.account',
      label: 'My Account',
      url: `${basePath}/account`,
    });
  }

  if (hasScope(scopes.app.settings.linkedAccounts.read)) {
    menus.push({
      name: 'settings.linked-accounts',
      label: 'Linked Accounts',
      url: `${basePath}/linked-accounts`,
    });
  }

  if (hasScope(scopes.app.settings.tokens.read)) {
    menus.push({
      name: 'settings.tokens',
      label: 'My Tokens',
      url: `${basePath}/tokens`,
    });
  }

  if (hasScope(scopes.app.settings.emails.read)) {
    menus.push({
      name: 'settings.emails',
      label: 'Email Preferences',
      url: `${basePath}/emails`,
    });
  }

  return [
    {
      sectionName: '',
      menus,
    },
  ];
}
