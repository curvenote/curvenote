import type { MenuContents } from '@curvenote/scms-core';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { registerExtensionNavigation, scopes } from '@curvenote/scms-core';
import { userHasScope, userHasSiteScope } from '@curvenote/scms-server';

interface AdminMenuItem {
  name: string;
  label: string;
  url: string;
  scope: string;
  /** Extra per-user app scope required in addition to `scope`. Checked with `userHasScope`. */
  appScope?: string;
}

interface AdminMenuSection {
  sectionName: string;
  menus: AdminMenuItem[];
}

export function administrationMenus(baseUrl: string): AdminMenuItem[] {
  return [
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
      name: 'admin.tags',
      label: 'Tags',
      url: `${baseUrl}/tags`,
      scope: scopes.site.tags.list,
    },
    {
      name: 'admin.forms',
      label: 'Submission Forms',
      url: `${baseUrl}/forms`,
      scope: scopes.site.forms.list,
    },
    {
      name: 'admin.doi',
      label: 'DOI Registration',
      url: `${baseUrl}/doi`,
      // Members hold site:doi:read; only admins hold configure, and only they see the screen.
      scope: scopes.site.doi.configure,
      // Per-user preview flag, granted through a Role (e.g. doi-preview), independent of the
      // Enterprise site.data.doiCustomPrefixEnabled flag on Site > Advanced.
      appScope: scopes.app.sites.doi.feature,
    },
    {
      name: 'admin.users',
      label: 'Users & Access',
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
      scope: scopes.system.admin,
    },
    {
      name: 'admin.analytics',
      label: 'Analytics',
      url: `${baseUrl}/analytics`,
      scope: scopes.site.analytics.list,
    },
  ];
}

export async function buildMenu(ctx: SiteContextWithUser): Promise<MenuContents> {
  const mountPoint = `app/sites/${ctx.site.name}`;
  const baseUrl = `/${mountPoint}`;

  const fromExtensions = await registerExtensionNavigation(ctx.$config, mountPoint, baseUrl);
  if (fromExtensions.replace) {
    return fromExtensions.menu;
  }

  const allMenuItems: AdminMenuSection[] = [
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
      menus: administrationMenus(baseUrl),
    },
  ];

  return allMenuItems
    .map((section) => ({
      ...section,
      menus: section.menus.filter((menu) => {
        if (menu.scope && !userHasSiteScope(ctx.user, menu.scope, ctx.site.id)) {
          return false;
        }
        if (menu.appScope && !userHasScope(ctx.user, menu.appScope)) {
          return false;
        }
        return true;
      }),
    }))
    .filter((section) => section.menus.length > 0);
}
