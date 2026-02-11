import type { Route } from './+types/route';
import { Link, redirect, type LoaderFunctionArgs } from 'react-router';
import {
  MainWrapper,
  PageFrame,
  primitives,
  formatDate,
  getBrandingFromMetaMatches,
  joinPageTitle,
  ui,
  TrackEvent,
  getWorkflows,
  registerExtensionWorkflows,
  scopes,
} from '@curvenote/scms-core';
import { withSecureWorkContext } from '@curvenote/scms-server';
import {
  dbGetLinkedJobsByWorkVersionIds,
  dbGetWorkVersionsWithSubmissionVersions,
} from '../works.$workId/db.server';
import { getUniqueSubmissions } from '../works.$workId/utils.server';
import type {
  SubmissionWithVersionsAndSite,
  WorkVersionWithSubmissionVersions,
} from '../works.$workId/types';
import type { Workflow } from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client';
import { Settings, PlusCircle, RefreshCw, Upload, Leaf } from 'lucide-react';

type LoaderData = {
  workflows: Record<string, Workflow>;
  work: { id: string; title?: string; authors?: { name: string }[] };
  versions: WorkVersionWithSubmissionVersions[];
  submissions: SubmissionWithVersionsAndSite[];
};

function formatMetadataValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v : String(v))).join(', ');
  }
  if (typeof value === 'object' && value !== null && 'content' in value) {
    const content = (value as { content?: { id?: string } }).content;
    return content?.id ?? String(value);
  }
  return String(value);
}

export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withSecureWorkContext(args, [scopes.work.read]);

  const { workId } = args.params;
  if (!workId) return redirect('/app/works');

  const workVersions = await dbGetWorkVersionsWithSubmissionVersions(ctx.work.id);
  if (!workVersions) throw redirect('/app/works');

  const isDraftOnlyWork = workVersions.length > 0 && workVersions.every((v) => v.draft);

  const url = new URL(args.request.url);
  const pathname = url.pathname;

  const isUploadPath = pathname.includes(`/app/works/${workId}/upload/`);
  const isDetailsLikePath =
    pathname === `/app/works/${workId}` ||
    pathname === `/app/works/${workId}/` ||
    pathname.startsWith(`/app/works/${workId}/details`) ||
    pathname.startsWith(`/app/works/${workId}/users`) ||
    pathname.startsWith(`/app/works/${workId}/checks`) ||
    pathname.startsWith(`/app/works/${workId}/site/`) ||
    pathname === `/app/works/v3/${workId}`;

  if (isDraftOnlyWork && !isUploadPath && isDetailsLikePath) {
    throw redirect(`/app/works/${workId}/upload/${workVersions[0].id}`);
  }

  const submissions = getUniqueSubmissions(workVersions);
  const workflowNames = submissions.map((s) => s.collection.workflow);

  const workflows = Object.fromEntries(
    Object.entries(getWorkflows(ctx.$config, registerExtensionWorkflows(extensions))).filter(
      ([name]) => workflowNames.includes(name),
    ),
  );

  await ctx.trackEvent(TrackEvent.WORK_VIEWED, {
    workId: ctx.work.id,
    workTitle: ctx.workDTO.title,
    versionCount: workVersions.length,
    submissionCount: submissions.length,
    isDraft: workVersions.length === 1 && workVersions[0].draft,
  });

  await ctx.analytics.flush();

  const versionIds = workVersions.map((v) => v.id);

  return {
    userScopes: ctx.scopes,
    workflows,
    work: ctx.workDTO,
    versions: workVersions ?? [],
    submissions: submissions ?? [],
    linkedJobsByWorkVersionId: dbGetLinkedJobsByWorkVersionIds(versionIds),
  };
}

export const meta: Route.MetaFunction = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle(loaderData?.work?.title, 'Work Details', branding.title) }];
};

export default function WorkDetailsV3Route({ loaderData }: Route.ComponentProps) {
  const { workflows, work, versions, submissions } = loaderData as LoaderData;
  const workId = work.id;

  const latestNonDraftVersion = versions.find((v) => !v.draft) ?? versions[0];
  const metaObj = (latestNonDraftVersion?.metadata ?? null) as Record<string, unknown> | null;
  const license = metaObj?.license != null ? formatMetadataValue(metaObj.license) : '—';
  const keywords = metaObj?.keywords != null ? formatMetadataValue(metaObj.keywords) : '—';
  const funding = metaObj?.funding != null ? formatMetadataValue(metaObj.funding) : '—';
  const lastUpdated =
    latestNonDraftVersion?.date_created != null
      ? formatDate(latestNonDraftVersion.date_created, 'MMM dd, yyyy')
      : '—';

  const truncatedTitle =
    work.title && work.title.length > 32
      ? work.title.substring(0, 32) + '...'
      : (work.title ?? 'Untitled Work');
  const breadcrumbs = [
    { label: 'Works', href: '/app/works' },
    { label: truncatedTitle, isCurrentPage: true },
  ];

  const submissionDetailBasePath = `/app/works/${workId}`;
  const latestVersionId = versions[0]?.id;

  return (
    <MainWrapper hasSecondaryNav={false}>
      <PageFrame breadcrumbs={breadcrumbs}>
        <div className="mt-4 space-y-6">
          {/* Work details header */}
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{work.title ?? 'Untitled Work'}</h1>
            <p className="text-base text-muted-foreground">
              {work.authors && work.authors.length > 0
                ? work.authors.map((a) => a.name).join(', ')
                : 'Unknown authors'}
            </p>
          </div>

          {/* Two-column: Metadata (left) + Submissions (right) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Metadata */}
            <primitives.Card className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Metadata</h2>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  aria-label="Edit metadata"
                >
                  <Settings className="w-4 h-4" />
                  Edit
                </button>
              </div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">License</dt>
                  <dd>{license}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Keywords</dt>
                  <dd>{keywords}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Funding</dt>
                  <dd>{funding}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Last updated</dt>
                  <dd>{lastUpdated}</dd>
                </div>
              </dl>
            </primitives.Card>

            {/* Submissions */}
            <primitives.Card className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Submissions</h2>
                {/* TODO: link to new submission flow (e.g. site picker) when available */}
                <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground opacity-90">
                  <PlusCircle className="w-4 h-4" />
                  New submission
                </span>
              </div>
              <ul className="space-y-3">
                {submissions.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No submissions yet.</li>
                ) : (
                  submissions.map((sub) => {
                    const latestSv = sub.versions[0];
                    if (!latestSv) return null;
                    const submissionUrl = `${submissionDetailBasePath}/site/${sub.site.name}/submission/${latestSv.id}`;
                    return (
                      <li
                        key={sub.id}
                        className="flex flex-wrap gap-2 justify-between items-center p-3 rounded-md border"
                      >
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="font-medium">{sub.site.title}</span>
                          <ui.SubmissionVersionBadge
                            submissionVersion={latestSv}
                            workflows={workflows}
                            basePath={submissionDetailBasePath}
                            workVersionId={latestSv.work_version_id}
                            showLink
                          />
                        </div>
                        <Link
                          to={submissionUrl}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1.5 text-sm hover:bg-muted"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Update
                        </Link>
                      </li>
                    );
                  })
                )}
              </ul>
            </primitives.Card>
          </div>

          {/* Revisions */}
          <primitives.Card className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Revisions</h2>
              {latestVersionId && (
                <Link
                  to={`/app/works/${workId}/upload/${latestVersionId}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Upload className="w-4 h-4" />
                  Upload new revision
                </Link>
              )}
            </div>
            <ul className="space-y-2">
              {versions.map((v) => {
                const nonDraftSvs = v.submissionVersions.filter((sv) => sv.status !== 'DRAFT');
                const isCurrent = latestNonDraftVersion?.id === v.id && !v.draft;
                return (
                  <li
                    key={v.id}
                    className="flex flex-wrap gap-2 items-center p-3 text-sm rounded-md border"
                  >
                    <span className="font-medium tabular-nums">
                      {formatDate(v.date_created, 'MMM dd, yyyy')}
                    </span>
                    {isCurrent && (
                      <ui.Badge variant="secondary" className="text-xs">
                        Current
                      </ui.Badge>
                    )}
                    {nonDraftSvs.length > 0 ? (
                      <span className="flex flex-wrap gap-2 items-center">
                        <Leaf className="w-4 h-4 text-muted-foreground" aria-hidden />
                        {nonDraftSvs.map((sv) => (
                          <ui.SubmissionVersionBadge
                            key={sv.id}
                            submissionVersion={sv}
                            workflows={workflows}
                            basePath={submissionDetailBasePath}
                            workVersionId={v.id}
                            showSite
                          />
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No submissions</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </primitives.Card>
        </div>
      </PageFrame>
    </MainWrapper>
  );
}
