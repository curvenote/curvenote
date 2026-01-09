// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildMenu(baseUrl: string, userScopes: string[]) {
  return [
    {
      sectionName: 'Discovery',
      menus: [
        {
          name: 'discovery.people',
          label: 'People',
          url: `${baseUrl}/people`,
        },
      ],
    },
  ];
}
