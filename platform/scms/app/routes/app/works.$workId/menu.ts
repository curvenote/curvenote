import type { MenuContents } from '@curvenote/scms-core';
import type { SubmissionWithVersionsAndSite } from './types';

export function buildMenu(
  baseUrl: string,
  drafting: boolean,
  submissions: SubmissionWithVersionsAndSite[],
  userScopes: string[],
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
    // menus.push({
    //   name: 'work.checks',
    //   label: 'Checks',
    //   url: `${baseUrl}/checks`,
    // });
    menus.push({
      name: 'work.users',
      label: 'Who can access this?',
      url: `${baseUrl}/users`,
    });
  }

  // Add menu items for each submission
  submissions.forEach((submission) => {
    // Use the latest submission version ID (versions are sorted newest first)
    const latestVersionId = submission.versions[0]?.id;
    if (!latestVersionId) return;
    menus.push({
      name: submission.site.name,
      label: `${submission.site.title}`,
      url: `${baseUrl}/site/${submission.site.name}/submission/${latestVersionId}`,
    });
  });

  return contents;
}
