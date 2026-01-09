import type { ServerSideMenuContents } from '@curvenote/scms-core';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildMenu(basePath: string, userScopes: string[]): ServerSideMenuContents {
  return [
    {
      sectionName: '',
      menus: [
        {
          name: 'settings.account',
          label: 'My Account',
          url: `${basePath}/account`,
        },
        {
          name: 'settings.linked-accounts',
          label: 'Linked Accounts',
          url: `${basePath}/linked-accounts`,
        },
        {
          name: 'settings.tokens',
          label: 'My Tokens',
          url: `${basePath}/tokens`,
        },
        {
          name: 'settings.emails',
          label: 'Email Preferences',
          url: `${basePath}/emails`,
        },
      ],
    },
  ];
}
