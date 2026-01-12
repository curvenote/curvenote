import type { MenuContents } from '@curvenote/scms-core';
import type { SiteContext } from '@curvenote/scms-server';
import { registerExtensionNavigation } from '@curvenote/scms-core';

export async function buildMenu(ctx: SiteContext): Promise<MenuContents> {
  const mountPoint = `app/sites/${ctx.site.name}`;
  const baseUrl = `/${mountPoint}`;

  const fromExtensions = await registerExtensionNavigation(ctx.$config, mountPoint, baseUrl);
  if (fromExtensions.replace) return fromExtensions.menu;

  return [
    {
      sectionName: 'Articles',
      menus: [
        {
          name: 'inbox',
          label: 'Inbox',
          url: `${baseUrl}/inbox`,
        },
        {
          name: 'submissions',
          label: 'All Submissions',
          url: 'submissions',
        },
      ],
    },
    {
      sectionName: 'Administration',
      menus: [
        {
          name: 'admin.kinds',
          label: 'Submission Kinds',
          url: `${baseUrl}/kinds`,
        },
        {
          name: 'admin.collections',
          label: 'Collections',
          url: `${baseUrl}/collections`,
        },
        {
          name: 'admin.users',
          label: 'Users',
          url: `${baseUrl}/users`,
        },
        {
          name: 'admin.website',
          label: 'Website & Design',
          url: `${baseUrl}/website`,
        },
        {
          name: 'admin.domains',
          label: 'Domains',
          url: `${baseUrl}/domains`,
        },
        {
          name: 'admin.advanced',
          label: 'Advanced',
          url: `${baseUrl}/advanced`,
        },
        {
          name: 'admin.analytics',
          label: 'Analytics',
          url: `${baseUrl}/analytics`,
        },
      ],
    },
  ];
}
