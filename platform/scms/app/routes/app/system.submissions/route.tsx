import { useState } from 'react';
import { withAppAdminContext, getPrismaClient } from '@curvenote/scms-server';
import {
  PageFrame,
  SystemAdminBadge,
  useSites,
  formatDate,
  formatDatetime,
  formatToNow,
  ui,
  primitives,
  SectionWithHeading,
  EmptyMessage,
  LoadingSpinner,
} from '@curvenote/scms-core';
import type { Route } from './+types/route';
import { data, Link, useFetcher } from 'react-router';
import type { SubmissionTreeDBO } from './db.server';
import {
  dbGetSiteSubmission,
  dbUpdateDatePublishedFromVersion,
  dbUpdateDatePublishedFromWork,
} from './db.server';
import { WorkRole } from '@prisma/client';
import { firstPublishedVersionDateCreated, lastPublishedVersionWorkDate } from './utils';
import { SiteSelect, WorkInfo } from './ui';
import { uuidv7 } from 'uuidv7';

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args);
  const prisma = await getPrismaClient();
  const users = await prisma?.user.findMany({
    select: {
      id: true,
      display_name: true,
      email: true,
    },
    orderBy: {
      display_name: 'asc',
    },
  });
  return { users };
}

export async function action(args: Route.ActionArgs) {
  await withAppAdminContext(args);
  const formData = await args.request.formData();
  const siteName = formData.get('site_name');
  const formAction = formData.get('formAction');

  if (formAction === 'date-published-from-work') {
    await dbUpdateDatePublishedFromWork(siteName as string);
  } else if (formAction === 'date-published-from-version') {
    await dbUpdateDatePublishedFromVersion(siteName as string);
  } else if (formAction === 'add-work-user') {
    const workId = formData.get('workId') as string;
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as WorkRole;

    const prisma = await getPrismaClient();

    // Add the user to the work
    const timestamp = new Date().toISOString();
    await prisma?.workUser.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        work_id: workId,
        user_id: userId,
        role,
      },
    });

    // Get the updated work users
    const work = await prisma?.work.findUnique({
      where: { id: workId },
      include: {
        work_users: {
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return { work_users: work?.work_users };
  } else if (formAction === 'remove-work-user') {
    const workUserId = formData.get('workUserId') as string;

    const prisma = await getPrismaClient();

    // First check if this is the last owner
    const workUser = await prisma?.workUser.findUnique({
      where: { id: workUserId },
      include: {
        work: {
          include: {
            work_users: true,
          },
        },
      },
    });

    if (!workUser) {
      return data({ error: 'Work user not found' }, { status: 404 });
    }

    if (workUser.role === WorkRole.OWNER && workUser.work.work_users.length <= 1) {
      return data({ error: 'Cannot remove the last owner' }, { status: 400 });
    }

    // Remove the work user
    await prisma?.workUser.delete({
      where: {
        id: workUserId,
      },
    });

    // Get the updated work users
    const updatedWork = await prisma?.work.findUnique({
      where: { id: workUser.work_id },
      include: {
        work_users: {
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return { work_users: updatedWork?.work_users };
  }

  const items = await dbGetSiteSubmission(siteName as string);
  return { items, siteName };
}

function filterNoDateAndPublished(items?: SubmissionTreeDBO) {
  return (items ?? []).filter((s) => {
    const version = s.versions.find((v) => v.status === 'PUBLISHED');
    return !!version && !s.date_published;
  });
}

export default function SubmissionAdmin({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const { users } = loaderData;
  const [site_name, setSiteName] = useState<string | undefined>();
  const { sites } = useSites();
  const siteName =
    fetcher.data && 'siteName' in fetcher.data && fetcher.data.siteName != null
      ? fetcher.data.siteName
      : '';
  const items =
    fetcher.data && 'items' in fetcher.data && fetcher.data.items != null ? fetcher.data.items : [];
  const itemsPublishedButNoDate = filterNoDateAndPublished(items);
  return (
    <PageFrame title="Submission Admin">
      <SystemAdminBadge />
      <ui.TooltipProvider>
        <div className="space-y-8">
          <primitives.Card className="p-6">
            <fetcher.Form method="post" className="flex items-center space-x-4">
              <SiteSelect
                sites={sites.items}
                disabled={fetcher.state !== 'idle'}
                onChange={(e) => {
                  const formData = new FormData(e.target.form ?? undefined);
                  setSiteName((formData.get('site_name') ?? undefined) as string | undefined);
                  fetcher.submit(e.target.form, { method: 'post' });
                }}
              />
              {fetcher.state !== 'idle' && <LoadingSpinner />}
            </fetcher.Form>
          </primitives.Card>

          {fetcher.data && (
            <div className="space-y-8">
              {itemsPublishedButNoDate.length > 0 && (
                <primitives.Card className="p-6">
                  <SectionWithHeading heading="Published submissions without date_published">
                    <div className="flex gap-4 mb-6">
                      <fetcher.Form method="post">
                        <input type="hidden" name="formAction" value="date-published-from-work" />
                        <input type="hidden" name="site_name" value={site_name} />
                        <ui.Button
                          variant="secondary"
                          type="submit"
                          disabled={fetcher.state === 'loading' || fetcher.state === 'submitting'}
                        >
                          Update with work.date
                        </ui.Button>
                      </fetcher.Form>
                      <fetcher.Form method="post">
                        <input
                          type="hidden"
                          name="formAction"
                          value="date-published-from-version"
                        />
                        <input type="hidden" name="site_name" value={site_name} />
                        <ui.Button
                          variant="secondary"
                          type="submit"
                          disabled={fetcher.state === 'loading' || fetcher.state === 'submitting'}
                        >
                          Update with version.date_created
                        </ui.Button>
                      </fetcher.Form>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2 bg-stone-100 dark:bg-stone-800">
                            <th className="p-3 text-sm font-medium text-left">Submission ID</th>
                            <th className="p-3 text-sm font-medium text-left">
                              Submission work date
                            </th>
                            <th className="p-3 text-sm font-medium text-left">
                              Published Version date_created
                            </th>
                            <th className="p-3 text-sm font-medium text-left">
                              Submission date_published
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {itemsPublishedButNoDate.map((s) => (
                            <tr
                              key={`${s.id}-3`}
                              className="hover:bg-stone-50 dark:hover:bg-stone-700/50"
                            >
                              <td className="p-3 text-sm">{s.id}</td>
                              <td className="p-3 text-sm">{lastPublishedVersionWorkDate(s)}</td>
                              <td className="p-3 text-sm">{firstPublishedVersionDateCreated(s)}</td>
                              <td className="p-3 text-sm">{s.date_published}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionWithHeading>
                </primitives.Card>
              )}

              <div className="space-y-8">
                <SectionWithHeading heading={`${siteName} (${items.length} total submissions)`}>
                  <div className="grid gap-6">
                    {items.map((s) => (
                      <primitives.Card key={s.id} className="p-4">
                        <div className="space-y-6">
                          {/* Submission Header */}
                          <div className="flex items-center justify-between pb-4 border-b">
                            <div className="space-y-1">
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {formatDatetime(s.date_created)}
                                </span>
                                <span className="text-sm font-medium">{s.kind.name}</span>
                                <span className="text-sm">{s.collection.name}</span>
                              </div>
                              <Link
                                to={`/app/sites/${siteName}/submissions/${s.id}`}
                                className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Submission ID: {s.id}
                              </Link>
                            </div>
                            <div className="text-sm">
                              Published: {s.date_published || 'Not published'}
                            </div>
                          </div>

                          {/* Work Versions List */}
                          <div className="space-y-4">
                            <h3 className="text-sm font-medium">Work Versions</h3>
                            <div className="space-y-3">
                              {s.versions.map((sv, index) => {
                                const workVersion = sv.work_version;
                                const work = workVersion.work;
                                return (
                                  <div
                                    key={sv.id}
                                    className={`grid grid-cols-2 gap-4 p-4 rounded-lg ${
                                      index % 2 === 0
                                        ? 'bg-stone-50 dark:bg-stone-800/50'
                                        : 'bg-stone-100 dark:bg-stone-800'
                                    }`}
                                  >
                                    {/* Work Version Info */}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-sm font-medium">Work Version</div>
                                        <div className="text-xs text-gray-500">
                                          ID: {workVersion.id}
                                        </div>
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {formatToNow(workVersion.date_created)}
                                      </div>
                                      <div className="space-y-1 text-sm">
                                        <div>
                                          Created: {formatDatetime(workVersion.date_created)}
                                        </div>
                                        <div>
                                          Date:{' '}
                                          {workVersion.date ? formatDate(workVersion.date) : 'none'}
                                        </div>
                                        <div>Title: {workVersion.title}</div>
                                        <div>DOI: {workVersion.doi || 'none'}</div>
                                      </div>
                                      <WorkInfo work={work} users={users} />
                                    </div>

                                    {/* Submission Version Info */}
                                    <div className="space-y-3">
                                      <div>
                                        <div className="text-sm font-medium">
                                          Submission Version
                                        </div>
                                        <div className="text-xs text-gray-500">ID: {sv.id}</div>
                                      </div>
                                      <div className="text-xs text-gray-500">{sv.status}</div>
                                      <div className="space-y-1 text-sm">
                                        <div>Created: {formatDate(sv.date_created)}</div>
                                        <div>Published: {sv.date_published || 'Not published'}</div>
                                      </div>
                                      <ui.Tooltip>
                                        <ui.TooltipTrigger className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                          View Details
                                        </ui.TooltipTrigger>
                                        <ui.TooltipContent className="max-w-[800px] max-h-[300px] overflow-y-auto">
                                          <pre className="text-xs break-words whitespace-pre-wrap">
                                            {JSON.stringify(sv, null, 2)}
                                          </pre>
                                        </ui.TooltipContent>
                                      </ui.Tooltip>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </primitives.Card>
                    ))}
                  </div>
                </SectionWithHeading>
              </div>
            </div>
          )}

          {fetcher.state === 'idle' && !fetcher.data && (
            <EmptyMessage message="Select a site to view submissions" />
          )}
        </div>
      </ui.TooltipProvider>
    </PageFrame>
  );
}
