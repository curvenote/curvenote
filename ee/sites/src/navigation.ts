import type { NavigationRegistration, MenuContents } from '@curvenote/scms-core';

export function registerNavigation(): NavigationRegistration[] {
  return [
    {
      attachTo: 'app',
      replace: false,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      register: (baseUrl: string): MenuContents => [
        {
          menus: [
            {
              name: 'sites',
              label: 'Sites',
              url: '/app/sites',
              icon: 'sites',
            },
          ],
        },
      ],
    },
  ];
}
