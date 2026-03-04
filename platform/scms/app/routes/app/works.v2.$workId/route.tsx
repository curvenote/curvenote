import type { Route } from './+types/route';
import { redirect, type LoaderFunctionArgs } from 'react-router';
import { Link, useRevalidator } from 'react-router';
import { useState } from 'react';
import { withSecureWorkContext } from '@curvenote/scms-server';
import {
  MainWrapper,
  PageFrame,
  formatDate,
  formatToNow,
  getBrandingFromMetaMatches,
  getWorkflows,
  joinPageTitle,
  primitives,
  registerExtensionWorkflows,
  scopes,
  SectionWithHeading,
  summarizeAuthors,
  ui,
} from '@curvenote/scms-core';
import { MoreHorizontal, Plus, MessageSquare, Share2, CheckCircle2 } from 'lucide-react';
import { dbGetWorkVersionsWithSubmissionVersions } from '../works.$workId/db.server';
import { getUniqueSubmissions } from '../works.$workId/utils.server';
import type { WorkVersionWithSubmissionVersions } from '../works.$workId/types';
import { dbGetWorkUsers, dtoWorkUsers, type DBO } from '../works.$workId.users/db.server';
import { WorkRolesForm } from '../works.$workId.users/WorkRolesForm';
import { extensions } from '../../../extensions/client';

export const loader = async (args: LoaderFunctionArgs) => {
  console.log('works.v2.$workId/route.tsx loader', args.params);
  const ctx = await withSecureWorkContext(args, [scopes.work.read]);

  const { workId } = args.params;
  if (!workId) {
    console.error('Work ID is required');
    return redirect('/app/works');
  }

  const workVersions = await dbGetWorkVersionsWithSubmissionVersions(ctx.work.id);
  if (!workVersions) {
    console.error('No work versions found');
    return redirect('/app/works');
  }

  const isDraftOnlyWork = workVersions.length > 0 && workVersions.every((v) => v.draft);

  const url = new URL(args.request.url);
  const pathname = url.pathname;

  if (isDraftOnlyWork) {
    const isUploadPath = pathname.includes(`/app/works/${workId}/upload/`);
    const isDetailsLikePath =
      pathname === `/app/works/${workId}` ||
      pathname === `/app/works/${workId}/` ||
      pathname.startsWith(`/app/works/${workId}/details`) ||
      pathname.startsWith(`/app/works/${workId}/users`) ||
      pathname.startsWith(`/app/works/${workId}/work-integrity`) ||
      pathname.startsWith(`/app/works/${workId}/site/`) ||
      pathname === `/app/works/v2/${workId}` ||
      pathname.startsWith(`/app/works/v2/${workId}/`);

    if (!isUploadPath && isDetailsLikePath) {
      throw redirect(`/app/works/${workId}/upload/${workVersions[0].id}`);
    }
  }

  const submissions = getUniqueSubmissions(workVersions);
  const workflowNames = submissions.map((s) => s.collection.workflow);
  const workflows = Object.fromEntries(
    Object.entries(getWorkflows(ctx.$config, registerExtensionWorkflows(extensions))).filter(
      ([name]) => workflowNames.includes(name),
    ),
  );

  const usersDbo = await dbGetWorkUsers(ctx.work.id);
  const collaborators = usersDbo ? dtoWorkUsers(usersDbo as DBO) : [];

  return {
    work: ctx.workDTO,
    versions: workVersions,
    submissions,
    workflows,
    collaborators,
  };
};

export const meta: Route.MetaFunction = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle(loaderData?.work?.title, 'Work Details v2', branding.title) }];
};

export function WorkDetailV2RouteA() {
  return <div>WorkDetailV2Route</div>;
}

export default function WorkDetailV2Route({ loaderData }: Route.ComponentProps) {
  const { work, versions, submissions, workflows, collaborators } = loaderData;
  const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
  const revalidator = useRevalidator();

  const truncatedTitle = work.title
    ? work.title.length > 32
      ? work.title.substring(0, 32) + '...'
      : work.title
    : 'Untitled Work';

  const breadcrumbs = [
    { label: 'Works', href: '/app/works/v2' },
    { label: truncatedTitle, isCurrentPage: true },
  ];

  const latestVersionDate = versions[0]?.date_created;
  const authorSummary =
    summarizeAuthors(work.authors ?? [], { maxDisplay: 3 }) || 'Unknown authors';

  // One badge per unique site (by site.id)
  const uniqueSites = [
    ...new Map(submissions.map((s) => [s.site.id, { site: s.site, submission: s }])).values(),
  ];

  const basePath = `/app/works/${work.id}`;

  return (
    <MainWrapper hasSecondaryNav={false}>
      <PageFrame breadcrumbs={breadcrumbs}>
        <div className="mt-4 space-y-8">
          {/* Summary section */}
          <primitives.Card lift className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr]">
              <div className="space-y-4">
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">DOI</dt>
                    <dd>
                      {work.links?.doi || work.doi ? (
                        <a
                          href={
                            work.links?.doi ??
                            (work.doi?.startsWith('http')
                              ? work.doi
                              : `https://doi.org/${work.doi}`)
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {work.links?.doi ?? work.doi}
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">License</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Latest version date</dt>
                    <dd>
                      {latestVersionDate
                        ? formatToNow(latestVersionDate, { addSuffix: true })
                        : '—'}
                    </dd>
                  </div>
                </dl>
                <div>
                  <dt className="mb-2 text-sm text-muted-foreground">Collaborators</dt>
                  <dd className="flex flex-wrap gap-2 items-center">
                    {collaborators.map((u) => (
                      <ui.Avatar key={u.id} className="w-8 h-8">
                        <ui.AvatarFallback className="text-xs">
                          {(u.display_name ?? u.email ?? '?').slice(0, 2).toUpperCase()}
                        </ui.AvatarFallback>
                      </ui.Avatar>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAddCollaboratorOpen(true)}
                      className="flex justify-center items-center w-8 h-8 rounded-full border-2 border-dashed shrink-0 border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                      aria-label="Add collaborator"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </dd>
                </div>
              </div>
              <div className="p-4 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground">
                  Synopsis view of content
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {work.title ?? 'Untitled'}
                </h2>
                {work.description && (
                  <p className="mt-2 text-sm text-foreground">{work.description}</p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">{authorSummary}</p>
              </div>
            </div>
          </primitives.Card>

          {/* Published In */}
          <SectionWithHeading heading="Published In">
            <div className="flex flex-wrap gap-2 items-center">
              {uniqueSites.map(({ site, submission }) => {
                const latestVersionId = submission.versions[0]?.id ?? submission.id;
                const href = `${basePath}/site/${site.name}/submission/${latestVersionId}`;
                return (
                  <ui.Tooltip key={site.id}>
                    <ui.TooltipTrigger asChild>
                      <Link to={href} prefetch="intent">
                        <ui.Badge
                          variant="secondary"
                          className="font-normal h-9 min-h-9 px-3 text-sm inline-flex items-center"
                        >
                          {site.title ?? site.name}
                        </ui.Badge>
                      </Link>
                    </ui.TooltipTrigger>
                    <ui.TooltipContent className="max-w-xs text-left bg-white text-gray-900 border border-gray-200 shadow-md dark:bg-gray-100 dark:text-gray-900 dark:border-gray-300">
                      This is where we would add links to latest version history and a link to more
                      details in the algorithm interface.
                    </ui.TooltipContent>
                  </ui.Tooltip>
                );
              })}
              <Link
                to={`/app/works/${work.id}/details`}
                className="inline-flex justify-center items-center px-3 h-9 text-sm rounded-md border-2 border-dashed border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
              >
                <Plus className="mr-1 w-4 h-4" />
                Publish new
              </Link>
            </div>
          </SectionWithHeading>

          {/* GitHub-style version listing (newest first) */}
          <SectionWithHeading heading="Versions">
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-10" aria-hidden>
                <div className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 bg-primary" />
              </div>
              <ul className="space-y-0">
                {[...versions]
                  .sort(
                    (a, b) =>
                      new Date(b.date_created).getTime() - new Date(a.date_created).getTime(),
                  )
                  .map((v: WorkVersionWithSubmissionVersions, idx: number) => {
                    const nonDraftSvs = v.submissionVersions.filter((sv) => sv.status !== 'DRAFT');
                    const hasMetadata = v.metadata && Object.keys(v.metadata as object).length > 0;
                    return (
                      <li key={v.id} className="flex items-center gap-4 pb-6 last:pb-0">
                        <div
                          className="relative z-10 flex w-10 shrink-0 justify-center"
                          aria-hidden
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-primary text-white">
                            <span className="text-xs font-medium">{versions.length - idx}</span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <primitives.Card lift className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-2">
                                <p className="text-sm font-medium">
                                  {formatDate(v.date_created, 'MMM dd, y h:mm a')}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                                    {hasMetadata ? 'Work Integrity' : 'Work integrity results —'}
                                  </span>
                                  {nonDraftSvs.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {nonDraftSvs.map((sv) => (
                                        <ui.SubmissionVersionBadge
                                          key={sv.id}
                                          submissionVersion={sv}
                                          workflows={workflows}
                                          basePath={basePath}
                                          workVersionId={v.id}
                                          showSite
                                        />
                                      ))}
                                    </div>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Share2 className="h-4 w-4" aria-hidden />
                                    Shared with —
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-4 w-4" aria-hidden />
                                    Has comments —
                                  </span>
                                </div>
                              </div>
                              <ui.Menu>
                                <ui.MenuTrigger asChild>
                                  <ui.Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Version actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </ui.Button>
                                </ui.MenuTrigger>
                                <ui.MenuContent>
                                  <ui.MenuItem onSelect={() => {}}>View</ui.MenuItem>
                                  <ui.MenuItem onSelect={() => {}}>Copy link</ui.MenuItem>
                                </ui.MenuContent>
                              </ui.Menu>
                            </div>
                          </primitives.Card>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </SectionWithHeading>
        </div>
      </PageFrame>

      <ui.Dialog open={addCollaboratorOpen} onOpenChange={setAddCollaboratorOpen}>
        <ui.DialogContent>
          <ui.DialogHeader>
            <ui.DialogTitle>Add collaborator</ui.DialogTitle>
            <ui.DialogDescription>
              Grant a user access to this work. They will be able to view and collaborate according
              to the role you choose.
            </ui.DialogDescription>
          </ui.DialogHeader>
          <WorkRolesForm
            submitAction={`/app/works/${work.id}/users`}
            onSuccess={() => {
              setAddCollaboratorOpen(false);
              revalidator.revalidate();
            }}
          />
        </ui.DialogContent>
      </ui.Dialog>
    </MainWrapper>
  );
}
