import { Link, useRouteLoaderData } from 'react-router';
import {
  primitives,
  formatToNow,
  PageFrame,
  SectionWithHeading,
  SiteLogo,
  getBrandingFromMetaMatches,
  joinPageTitle,
  ui,
} from '@curvenote/scms-core';
import type { MetaFunction } from 'react-router';
import type { WorkDTO } from '@curvenote/common';
import { GitBranch, Radio } from 'lucide-react';
import { WorkVersionsTable } from './WorkVersionsTable';
import type {
  SubmissionWithVersionsAndSite,
  WorkVersionWithSubmissionVersions,
} from '../works.$workId/types';
import type { Workflow } from '@curvenote/scms-core';

type LoaderData = {
  workflows: Record<string, Workflow>;
  work: WorkDTO;
  versions: WorkVersionWithSubmissionVersions[];
  submissions: SubmissionWithVersionsAndSite[];
};

export const meta: MetaFunction<() => LoaderData> = ({ matches, data }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle(data?.work?.title, 'Work Details', branding.title) }];
};

export default function WorkDetailRoute() {
  const { workflows, work, versions, submissions } = useRouteLoaderData(
    'routes/app/works.$workId/route',
  ) as LoaderData;

  const truncatedTitle = work.title
    ? work.title.length > 32
      ? work.title.substring(0, 32) + '...'
      : work.title
    : 'Untitled Work';

  const breadcrumbs = [
    { label: 'Works', href: '/app/works' },
    { label: truncatedTitle, isCurrentPage: true },
  ];

  return (
    <PageFrame breadcrumbs={breadcrumbs}>
      <div className="mt-4 space-y-6 md:space-y-12">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">{work.title}</h2>
          <div className="text-base">{work.description}</div>
          <div className="text-base text-muted-foreground">
            {work.authors && work.authors.length > 0
              ? work.authors.map((a) => a.name).join(', ')
              : 'Unknown authors'}
          </div>
          <div className="text-xs text-muted-foreground">
            Last updated {formatToNow(versions[0].date_created, { addSuffix: true })}
          </div>
        </div>
        <SectionWithHeading heading="Submissions" icon={Radio}>
          <div className="grid grid-cols-1 gap-5 mt-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {submissions.map((sub) => {
              const metadata = sub.site.metadata as { logo: string; logo_dark: string };
              // Use the latest submission version ID (versions are sorted newest first)
              const latestVersionId = sub.versions[0]?.id || sub.id;
              const linkTarget = `../site/${sub.site.name}/submission/${latestVersionId}`;
              return (
                <div key={sub.id}>
                  <Link
                    className="flex justify-center block"
                    prefetch="intent"
                    relative="path"
                    to={linkTarget}
                  >
                    <primitives.Card
                      className="h-auto space-y-3 p-2 lg:px-4 lg:pt-4 max-w-[300px] flex flex-col items-left"
                      lift
                    >
                      <div className="flex justify-center">
                        <SiteLogo
                          className="object-cover mb-2 h-14"
                          alt={sub.site.title}
                          logo={metadata.logo}
                          logo_dark={metadata.logo_dark}
                        />
                      </div>
                      <div>
                        <Link
                          prefetch="intent"
                          relative="path"
                          to={linkTarget}
                          className="block no-underline hover:underline"
                        >
                          <h3>{sub.site.title}</h3>
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {`Updated ${formatToNow(sub.date_created, { addSuffix: true })}`}
                        </div>
                      </div>
                      <div>
                        <ui.SubmissionVersionBadge
                          submissionVersion={sub.versions[0]}
                          workflows={workflows}
                          basePath={`/app/works/${work.id}`}
                          workVersionId={sub.versions[0].id}
                          showLink
                        />
                      </div>
                    </primitives.Card>
                  </Link>
                </div>
              );
            })}
          </div>
        </SectionWithHeading>
        <SectionWithHeading
          className=""
          heading={
            (
              <span className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Versions
              </span>
            ) as React.ReactNode
          }
        >
          <primitives.Card lift>
            <WorkVersionsTable
              workflows={workflows}
              versions={versions}
              basePath={`/app/works/${work.id}`}
            />
          </primitives.Card>
        </SectionWithHeading>
      </div>
    </PageFrame>
  );
}
