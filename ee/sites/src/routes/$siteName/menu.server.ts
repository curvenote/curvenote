import type { MenuContents } from '@curvenote/scms-core';
import type { SiteContext } from '@curvenote/scms-server';
import { registerExtensionNavigation, scopes } from '@curvenote/scms-core';
import { userHasSiteScope } from '@curvenote/scms-server';

export async function buildMenu(ctx: SiteContext): Promise<MenuContents> {
  const mountPoint = `app/sites/${ctx.site.name}`;
  const baseUrl = `/${mountPoint}`;

  const fromExtensions = await registerExtensionNavigation(ctx.$config, mountPoint, baseUrl);
  if (fromExtensions.replace) return fromExtensions.menu;

  const allMenuItems = [
    {
      sectionName: 'Articles',
      menus: [
        {
          name: 'inbox',
          label: 'Inbox',
          url: `${baseUrl}/inbox`,
          scope: scopes.site.submissions.list,
        },
        {
          name: 'submissions',
          label: 'All Submissions',
          url: 'submissions',
          scope: scopes.site.submissions.list,
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
          scope: scopes.site.kinds.list,
        },
        {
          name: 'admin.collections',
          label: 'Collections',
          url: `${baseUrl}/collections`,
          scope: scopes.site.collections.list,
        },
        {
          name: 'admin.forms',
          label: 'Submission Forms',
          url: `${baseUrl}/forms`,
          scope: scopes.site.forms.list,
        },
        {
          name: 'admin.users',
          label: 'Users',
          url: `${baseUrl}/users`,
          scope: scopes.site.users.list,
        },
        {
          name: 'admin.website',
          label: 'Website & Design',
          url: `${baseUrl}/website`,
          scope: scopes.site.update,
        },
        {
          name: 'admin.domains',
          label: 'Domains',
          url: `${baseUrl}/domains`,
          scope: scopes.site.domains.list,
        },
        {
          name: 'admin.advanced',
          label: 'Advanced',
          url: `${baseUrl}/advanced`,
          scope: scopes.site.update,
        },
        {
          name: 'admin.analytics',
          label: 'Analytics',
          url: `${baseUrl}/analytics`,
          scope: scopes.site.read,
        },
      ],
    },
  ];

  // Filter menu items based on user scopes
  return allMenuItems
    .map((section) => ({
      ...section,
      menus: section.menus.filter((menu) => {
        if (!menu.scope) return true; // Show if no scope required
        return userHasSiteScope(ctx.user, menu.scope, ctx.site.id);
      }),
    }))
    .filter((section) => section.menus.length > 0); // Remove empty sections
}
