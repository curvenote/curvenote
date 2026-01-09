// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildMenu(baseUrl: string, userScopes: string[]) {
  return [
    {
      sectionName: 'Platform Administration',
      menus: [
        {
          name: 'platform.users',
          label: 'Users',
          url: `${baseUrl}/users`,
        },
        {
          name: 'platform.onboarding',
          label: 'Onboarding',
          url: `${baseUrl}/onboarding`,
        },
        {
          name: 'platform.workflows',
          label: 'Workflows',
          url: `${baseUrl}/workflows`,
        },
        {
          name: 'platform.messages',
          label: 'Messages',
          url: `${baseUrl}/messages`,
        },
        {
          name: 'platform.extensions',
          label: 'Extensions',
          url: `${baseUrl}/extensions`,
        },
        {
          name: 'platform.analytics',
          label: 'Analytics',
          url: `${baseUrl}/analytics`,
        },
      ],
    },
  ];
}
