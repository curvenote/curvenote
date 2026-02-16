import { Link, useRouteLoaderData, useNavigate, useFetcher } from 'react-router';
import {
  primitives,
  formatToNow,
  PageFrame,
  FrameHeader,
  SectionWithHeading,
  SiteLogo,
  getBrandingFromMetaMatches,
  joinPageTitle,
  ui,
} from '@curvenote/scms-core';
import type { MetaFunction } from 'react-router';
import type { WorkDTO } from '@curvenote/common';
import type { Workflow } from '@curvenote/scms-core';
import { Radio, Upload } from 'lucide-react';
import { useEffect } from 'react';
import { useRouteLoaderData } from 'react-router';
import { getBrandingFromMetaMatches, joinPageTitle } from '@curvenote/scms-core';
import type { MetaFunction } from 'react-router';
import type { WorkDTO } from '@curvenote/common';
import { WorkVersionTimeline } from './WorkVersionTimeline';
import { WorkDetailsTopBar } from './WorkDetailsTopBar';
import { WorkDetailsContentCard } from './WorkDetailsContentCard';
import { SubmittedToBar } from './SubmittedToBar';
import type {
  SubmissionWithVersionsAndSite,
  WorkVersionWithSubmissionVersions,
} from '../works.$workId/types';
import type { WorkActivityRow } from '../works.$workId/db.server';
import type { LinkedJobsByWorkVersionId } from './types';

type WorkUser = {
  id: string;
  display_name: string | null;
  email: string | null;
  work_roles: string[];
};

type LoaderData = {
  userScopes: string[];
  workflows: Record<string, Workflow>;
  work: WorkDTO;
  versions: WorkVersionWithSubmissionVersions[];
  submissions: SubmissionWithVersionsAndSite[];
  linkedJobsByWorkVersionId: Promise<LinkedJobsByWorkVersionId>;
  workOwnerName: string | null;
  activities: WorkActivityRow[];
  canUpload: boolean;
  users: WorkUser[];
};

export const meta: MetaFunction<() => LoaderData> = ({ matches, data }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle(data?.work?.title, 'Work Details', branding.title) }];
};

export default function WorkDetailRoute() {
  const {
    userScopes,
    workflows,
    work,
    versions,
    submissions,
    linkedJobsByWorkVersionId,
    workOwnerName,
    activities,
    canUpload,
    users,
  } = useRouteLoaderData('routes/app/works.$workId/route') as LoaderData;

  const navigate = useNavigate();
  const fetcher = useFetcher<{
    intent?: string;
    success?: boolean;
    workId?: string;
    workVersionId?: string;
  }>();

  const workBasePath = `/app/works/${work.id}`;

  // Versions are ordered by date_modified desc; latest is first. Draft is resumable if it has checks metadata.
  const latestVersion = versions[0];
  const canResumeDraft =
    canUpload &&
    latestVersion?.draft === true &&
    latestVersion.metadata != null &&
    typeof latestVersion.metadata === 'object' &&
    'checks' in latestVersion.metadata;

  const uploadButtonLabel = canResumeDraft ? 'Resume Draft Version' : 'Upload New Version';

  const handleUploadAction = () => {
    if (!canUpload) return;
    if (canResumeDraft && latestVersion) {
      navigate(`${workBasePath}/upload/${latestVersion.id}`);
      return;
    }
    const formData = new FormData();
    formData.append('intent', 'create-new-version');
    fetcher.submit(formData, { method: 'post', action: workBasePath });
  };

  useEffect(() => {
    if (
      fetcher.data &&
      'intent' in fetcher.data &&
      fetcher.data.intent === 'create-new-version' &&
      fetcher.state === 'idle'
    ) {
      if (
        'success' in fetcher.data &&
        fetcher.data.success &&
        fetcher.data.workId &&
        fetcher.data.workVersionId
      ) {
        navigate(`${workBasePath}/upload/${fetcher.data.workVersionId}`);
      }
    }
  }, [fetcher.state, fetcher.data, navigate, workBasePath]);

  // Prefer the latest non-draft work version for user-facing "Last updated" copy.
  // (Versions are sorted newest-first, but drafts may appear at the top.)

  const latestNonDraftWorkVersion = versions.find((v) => !v.draft);
  const lastUpdatedDate =
    latestNonDraftWorkVersion?.date_modified ?? versions[0]?.date_modified ?? undefined;
  const uploadHref = latestNonDraftWorkVersion
    ? `/app/works/${work.id}/upload/${latestNonDraftWorkVersion.id}`
    : null;

  const truncatedTitle = work.title
    ? work.title.length > 32
      ? work.title.substring(0, 32) + '...'
      : work.title
    : 'Untitled Work';

  const breadcrumbs = [
    { label: 'Works', href: '/app/works' },
    { label: truncatedTitle, isCurrentPage: true },
  ];

  const basePath = `/app/works/${work.id}`;

  return (
    <div
      className="relative w-full py-16 pr-4 xl:mt-0 xl:py-[56px] xl:pr-8 2xl:pr-16 xl:pl-10 2xl:pl-16 max-w-[1400px]"
      data-name="page-frame"
    >
      <div className="space-y-12">
        <WorkDetailsTopBar workId={work.id} users={users} uploadHref={uploadHref} />
        <div className="space-y-1">
          <WorkDetailsContentCard version={latestNonDraftWorkVersion ?? null} />
          <SubmittedToBar submissions={submissions} workflows={workflows} basePath={basePath} />
        </div>
        <div>
          <WorkVersionTimeline
            versions={versions}
            workflows={workflows}
            workOwnerName={workOwnerName}
            basePath={basePath}
            userScopes={userScopes}
            linkedJobsByWorkVersionId={linkedJobsByWorkVersionId}
            activities={activities}
          />
        <div className="mt-4 space-y-6 md:space-y-12">
          <div className="space-y-2">
            <div className="text-base text-muted-foreground">
              {work.authors && work.authors.length > 0
                ? work.authors.map((a) => a.name).join(', ')
                : 'Unknown authors'}
            </div>
            {lastUpdatedDate && (
              <div className="text-xs text-muted-foreground">
                Last updated {formatToNow(lastUpdatedDate, { addSuffix: true })}
              </div>
            )}
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
                      className="block flex justify-center"
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
                            workVersionId={sub.versions[0].work_version_id}
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
          <div>
            <WorkVersionTimeline
              versions={versions}
              workflows={workflows}
              workOwnerName={workOwnerName}
              basePath={`/app/works/${work.id}`}
              userScopes={userScopes}
              linkedJobsByWorkVersionId={linkedJobsByWorkVersionId}
              activities={activities}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
