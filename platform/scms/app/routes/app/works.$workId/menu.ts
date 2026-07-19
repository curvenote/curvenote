import type { MenuContents } from '@curvenote/scms-core';
import type { SubmissionWithVersionsAndSite } from './types';
import { scopes } from '@curvenote/scms-core';

function siteLogoFromMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object' || !('logo' in metadata)) {
    return undefined;
  }
  const logo = (metadata as { logo?: unknown }).logo;
  return typeof logo === 'string' ? logo : undefined;
}

export function buildMenu(
  baseUrl: string,
  drafting: boolean,
  submissions: SubmissionWithVersionsAndSite[],
  userScopes: string[],
  canReadUsers: boolean,
) {
  const contents: MenuContents = [
    {
      sectionName: 'Article',
      menus: [],
    },
  ];
  const menus = contents[0].menus;

  if (!drafting) {
    menus.push({
      name: 'work.details',
      label: 'Work Details',
      url: `${baseUrl}/details`,
      end: true,
    });
    if (userScopes.includes(scopes.app.works.checks.feature)) {
      menus.push({
        name: 'work.checks',
        label: 'Checks',
        url: `${baseUrl}/checks`,
      });
    }
    if (canReadUsers) {
      menus.push({
        name: 'work.users',
        label: 'Who can access this?',
        url: `${baseUrl}/users`,
      });
    }
  }

  const submissionMenus = submissions.flatMap((submission) => {
    const latestVersionId = submission.versions[0]?.id;
    if (!latestVersionId) return [];
    return [
      {
        label: submission.site.title,
        url: `${baseUrl}/site/${submission.site.name}/submission/${latestVersionId}`,
        logo: siteLogoFromMetadata(submission.site.metadata),
        siteName: submission.site.name,
      },
    ];
  });

  if (submissionMenus.length > 0) {
    menus.push({
      name: 'work.submissions',
      label: 'Submissions',
      url: submissionMenus[0].url,
      subMenus: submissionMenus,
    });
  }

  return contents;
}
