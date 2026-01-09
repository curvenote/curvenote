// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildMenu(baseUrl: string, userScopes: string[]) {
  return [
    {
      sectionName: 'System Administration',
      menus: [
        {
          name: 'system.users',
          label: 'Users',
          url: `${baseUrl}/users`,
        },
        {
          name: 'admin.roles',
          label: 'Roles',
          icon: 'graduation-cap',
          url: `${baseUrl}/roles`,
        },
        {
          name: 'admin.new-site',
          label: 'Add Site',
          url: `${baseUrl}/add-site`,
        },
        {
          name: 'admin.submissions',
          label: 'Submissions',
          url: `${baseUrl}/submissions`,
        },
        {
          name: 'admin.storage',
          label: 'Storage',
          url: `${baseUrl}/storage`,
        },
        {
          name: 'admin.migrate',
          label: 'Migrate',
          url: `${baseUrl}/migrate`,
        },
        {
          name: 'admin.email-test',
          label: 'Email Test',
          url: `${baseUrl}/email-test`,
        },
        {
          name: 'admin.design',
          label: 'Design',
          url: `${baseUrl}/design`,
        },
        {
          name: 'admin.analytics-events',
          label: 'Analytics Events',
          url: `${baseUrl}/analytics-events`,
        },
        {
          name: 'admin.analytics-dashboards',
          icon: 'layout-dashboard',
          label: 'Analytics Dashboards',
          url: `${baseUrl}/analytics-dashboards`,
        },
      ],
    },
  ];
}
