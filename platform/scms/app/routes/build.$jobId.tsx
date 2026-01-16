import type { Route } from './+types/build.$jobId';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { Context } from '@curvenote/scms-server';
import {
  withContext,
  getPrismaClient,
  createPreviewToken,
  signPrivateUrls,
  sites,
  jobs,
} from '@curvenote/scms-server';
import {
  primitives,
  cn,
  formatDate,
  httpError,
  coerceToObject,
  getStatusDotClasses,
  SiteLogo,
  useTheme,
  ThemeSwitcher,
  KnownJobTypes,
} from '@curvenote/scms-core';
import { CurvenoteLogo, CurvenoteText } from '@curvenote/icons';
import type { $Enums } from '@curvenote/scms-db';
import { Checks } from '@curvenote/check-ui';
import { Theme, ThemeProvider } from '@myst-theme/providers';
import { DEFAULT_RENDERERS } from 'myst-to-react';
import {
  FileClock,
  Folder,
  FolderGit2,
  FolderKey,
  GitBranch,
  GitCommitHorizontal,
  Server,
  TerminalSquare,
  Wifi,
  KeyRound,
  AsteriskSquare,
} from 'lucide-react';
import type { SiteDTO } from '@curvenote/common';
import { Link } from 'react-router';

async function dbGetSubmissionVersion(submissionVersionId: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionVersion.findUnique({
    where: { id: submissionVersionId },
    include: {
      submission: {
        include: {
          kind: true,
          site: { include: { submissionKinds: true, collections: true, domains: true } },
        },
      },
      work_version: { include: { work: true } },
    },
  });
}

type DBO = Exclude<Awaited<ReturnType<typeof dbGetSubmissionVersion>>, null>;

function formatSubmissionVersionDTO(ctx: Context, dbo: DBO) {
  const site = sites.formatSiteDTO(ctx, dbo.submission.site);
  const signature = createPreviewToken(
    dbo.submission.site.name,
    dbo.submission_id,
    ctx.$config.api.previewIssuer,
    ctx.$config.api.previewSigningSecret,
  );
  const { cdn, cdn_key } = dbo.work_version;

  let thumbnail: string | undefined;
  if (cdn && cdn_key) {
    const { thumbnail: thumbnailUrl } = signPrivateUrls(
      ctx,
      { cdn, key: cdn_key },
      ctx.asApiUrl(
        `/sites/${site.name}/works/${dbo.work_version.work_id}/versions/${dbo.work_version_id}/thumbnail`,
      ),
      ctx.asApiUrl(
        `/sites/${site.name}/works/${dbo.work_version.work_id}/versions/${dbo.work_version_id}/social`,
      ),
    );
    thumbnail = thumbnailUrl;
  }

  const renderServiceUrl = ctx.$config.app?.renderServiceUrl;

  return {
    id: dbo.id,
    submission_id: dbo.submission_id,
    status: dbo.status,
    date_created: dbo.date_created,
    kind: dbo.submission.kind,
    work_version: {
      title: dbo.work_version.title,
      description: dbo.work_version.description,
      authors: dbo.work_version.authors,
      doi: dbo.work_version.doi ?? dbo.work_version.work.doi,
      date: dbo.work_version.date,
      cdn,
      cdn_key,
    },
    links: {
      submission: ctx.asApiUrl(
        `/sites/${dbo.submission.site.name}/submissions/${dbo.submission.id}`,
      ),
      site: ctx.asApiUrl(`/sites/${dbo.submission.site.name}`),
      admin: ctx.asBaseUrl(
        `/app/sites/${dbo.submission.site.name}/submissions/${dbo.submission.id}`,
      ),
      preview: `${renderServiceUrl || site.links.html}/previews/${dbo.id}?preview=${signature}`,
      thumbnail,
    },
  };
}

export async function loader(args: any) {
  const ctx = await withContext(args);

  const { jobId } = args.params;
  if (!jobId) throw httpError(400, 'Missing jobId');
  const job = await jobs.get(ctx, jobId);
  if (!job) throw httpError(404, 'Job not found');

  const payload = coerceToObject(job.payload);
  const results = coerceToObject(job.results);

  let site: SiteDTO | undefined;
  if (payload.site || payload.journal) {
    site = await sites.get(ctx, payload.site ?? payload.journal);
  }

  let submissionVersion: ReturnType<typeof formatSubmissionVersionDTO> | undefined;
  if (results.submissionVersionId) {
    const dbo = await dbGetSubmissionVersion(results.submissionVersionId);
    if (dbo) submissionVersion = formatSubmissionVersionDTO(ctx, dbo);
  }

  return {
    scopes: ctx.scopes,
    job,
    site,
    submissionVersion,
  };
}

function MiniPanelItem({ title, content }: { title: string; content: React.ReactNode }) {
  return (
    <div>
      <div className="font-light text-gray-600 dark:text-gray-200">{title}</div>
      <div className="flex gap-1 items-center mt-1 text-sm dark:text-gray-200">{content}</div>
    </div>
  );
}

function PreviewAndArtifacts({
  sv,
}: {
  sv: ReturnType<typeof formatSubmissionVersionDTO> | undefined;
}) {
  if (!sv) return null;
  return (
    <div className="flex flex-wrap gap-4 items-center shrink lg:items-start lg:flex-col dark:text-gray-200">
      {sv && (
        <div className="">
          <a
            href={sv.links.preview}
            className="inline-block px-4 py-2 text-center text-white align-middle rounded-md transition-shadow duration-150 hover:text-white bg-curvenote-blue hover:shadow-md dark:hover:shadow-dark-visible"
            target="_blank"
            rel="noreferrer noopener"
          >
            Preview
            <ArrowTopRightOnSquareIcon className="inline-block w-5 h-5 stroke-[1.5px] ml-1 align-text-bottom" />
          </a>
        </div>
      )}
      {sv.work_version && (
        <div>
          <div className="font-light text-gray-600 dark:text-gray-200">doi</div>
          <div className="font-mono text-sm">
            {!sv.work_version?.doi ? 'none' : sv.work_version?.doi}
          </div>
        </div>
      )}
      {sv && (
        <div>
          <div className="font-light text-gray-600 dark:text-gray-200">For Editors</div>
          <div className="space-y-1">
            <div className="font-mono text-sm">
              {' '}
              <Link
                title={sv.submission_id}
                className="underline"
                to={sv.links.admin}
                target="_blank"
                rel="noreferrer noopener"
              >
                submission
                <ArrowTopRightOnSquareIcon className="inline-block ml-1 w-4 h-4 align-text-bottom" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRetentionPolicyText(cdn: string) {
  const hostname = new URL(cdn).hostname;
  if (hostname.startsWith('localhost')) return 'local storage';
  else if (hostname.startsWith('cdn') || hostname.startsWith('pub'))
    return 'public CDN, long term retention policy with archival';
  else if (hostname.startsWith('prv')) return 'private CDN, long term retention policy';
  else if (hostname.startsWith('tmp')) return 'temporary CDN, 30-day retention policy';
  return undefined;
}

export default function BuildScreen({ loaderData }: Route.ComponentProps) {
  const { job, site, submissionVersion: sv } = loaderData;
  const [adminTheme] = useTheme();
  const mystTheme: Theme = adminTheme === 'dark' ? Theme.dark : Theme.light;

  const payload = coerceToObject(job.payload) as {
    key: string;
    source?: {
      repo: string;
      branch: string;
      commit: string;
      path: string;
    };
  };
  const source = payload.source;
  const results = coerceToObject(job.results);

  const wv = sv?.work_version;
  const retentionPolicy = wv && wv.cdn ? getRetentionPolicyText(wv.cdn) : undefined;

  return (
    <div className="relative flex flex-col *:border-b-[1px] *:border-gray-300 dark:bg-gray-900 min-h-screen">
      <div className="w-full">
        <div className="p-2 max-w-[1280px] mx-auto flex justify-between">
          <div className="flex flex-col gap-2 justify-center items-center p-4 max-w-max">
            <CurvenoteLogo fill="" className="text-curvenote-blue dark:text-white md:hidden" />
            <CurvenoteText
              fill=""
              className="hidden text-curvenote-blue dark:text-white md:block"
            />
          </div>
          <div className="flex justify-center grow">
            <div className="flex items-center">
              <ThemeSwitcher />
            </div>
          </div>
          {site && (
            <div className="flex p-4 justify-center sm:justify-end sm:basis-[262px]">
              <div>
                <div className="flex justify-center">
                  <SiteLogo
                    className="object-cover h-7 sm:h-10"
                    alt={site.title ?? ''}
                    logo={site.logo}
                    logo_dark={site.logo_dark}
                  />
                </div>
                <div className="hidden pt-1 text-gray-600 dark:text-white sm:flex">
                  {site.title}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="w-full grow">
        <div className="w-full max-w-[1280px] mx-auto flex flex-col items-center px-4 py-8 space-y-4">
          <div className="flex flex-col gap-4 w-full xl:gap-12 md:py-8 xl:py-24 md:flex-row">
            <div className="sm:basis-1/3 sm:min-w-[340px] grow lg:grow-0">
              <>
                {!wv && (
                  <div className="border-[1px] border-black dark:border-gray-300 flex flex-col rounded-lg overflow-hidden">
                    <div className="flex relative justify-center bg-gray-200">
                      <primitives.Thumbnail
                        className="w-full h-[260px]"
                        alt="thumbnail image"
                        src="https://source.unsplash.com/random/featured/?patience"
                      />
                    </div>
                    <div className="flex p-1 px-3 text-sm bg-gray-200 text-stone-600">
                      <div className="font-semibold small-caps">Work Unavailable</div>
                      <div className="pl-2 ml-2 font-light border-l border-gray-50">
                        Image courtesy of Unsplash
                      </div>
                    </div>
                  </div>
                )}
                {wv && (
                  <a
                    className="border-[1px] border-black dark:border-gray-300 flex flex-col rounded-lg overflow-hidden cursor-pointer"
                    href={sv.links.preview}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="flex relative justify-center bg-gray-200">
                      <primitives.Thumbnail
                        className="w-full h-[200px]"
                        alt="thumbnail image"
                        src={sv?.links.thumbnail}
                      />
                    </div>
                    <div className="flex p-1 px-3 text-sm bg-gray-200 text-stone-600">
                      <div className="font-semibold small-caps">{sv?.kind.name ?? ' '}</div>
                      {wv?.date && (
                        <div className="pl-2 ml-2 font-light border-l border-gray-50">
                          <span className="">{formatDate(wv.date)}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1 dark:text-gray-200">
                      <div className="text-lg font-semibold">{wv?.title ?? ' '}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {wv?.description ?? ' '}
                      </div>
                      <div className="text-sm">{wv ? wv?.authors.join(', ') : ' '}</div>
                    </div>
                  </a>
                )}
                <div className="flex py-6 lg:hidden">
                  <PreviewAndArtifacts sv={sv} />
                </div>
              </>
            </div>
            <div className="flex flex-col gap-4 grow basis-5/12">
              <div className="flex flex-col gap-4 md:justify-between md:w-full sm:gap-8 md:gap-4 sm:flex-row md:flex-col lg:gap-1 lg:flex-row">
                <MiniPanelItem
                  title="Build Status"
                  content={
                    <>
                      <div
                        className={cn(
                          'inline-block w-2 h-2 bg-green-600 rounded-full',
                          getStatusDotClasses(job.status as $Enums.JobStatus),
                        )}
                      />
                      {job.status}
                    </>
                  }
                />
                <MiniPanelItem
                  title="Submission Status"
                  content={
                    <>
                      <div
                        className={cn(
                          'inline-block w-2 h-2 rounded-full',
                          sv?.status ? getStatusDotClasses(sv.status) : 'bg-gray-400',
                        )}
                      />
                      {sv?.status ?? 'unknown'}
                    </>
                  }
                />
                <MiniPanelItem
                  title="Timestamp"
                  content={formatDate(job.date_modified ?? job.date_created, 'MMM dd, y HH:mm:ss')}
                />
              </div>
              <div>
                <div className="font-light text-gray-600 dark:text-gray-200">Submission</div>
                <div className="mt-1 space-y-2 text-gray-800 dark:text-gray-200">
                  {payload?.key && (
                    <div className="flex items-center font-mono text-sm" title="submission id">
                      <KeyRound className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                      {payload?.key}
                    </div>
                  )}
                  {!payload?.key && (
                    <div
                      className="flex items-center font-mono text-sm"
                      title="submission version id"
                    >
                      <AsteriskSquare className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                      {sv?.id}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="font-light text-gray-600 dark:text-gray-200">Source</div>
                <div className="mt-1 space-y-2 font-mono text-sm text-gray-800 cursor-default dark:text-gray-200">
                  <div>
                    {job.job_type === KnownJobTypes.CLI_CHECK ? (
                      <span title="submitted from command line">
                        <TerminalSquare className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                        command line
                      </span>
                    ) : (
                      <span title="submitted online">
                        <Wifi className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                        online
                      </span>
                    )}
                  </div>
                  {source?.repo && (
                    <div className="flex items-center" title="source repository">
                      <FolderGit2 className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                      <a
                        className="underline"
                        href={`https://${source.repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.repo}
                      </a>
                    </div>
                  )}
                  {source?.branch && (
                    <div className="flex items-center" title="source branch">
                      <GitBranch className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                      <a
                        className="underline"
                        href={`https://${source.repo}/tree/${source.branch}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.branch}
                      </a>
                    </div>
                  )}
                  {source?.commit && (
                    <div className="flex items-center" title="source commit">
                      <GitCommitHorizontal className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                      <a
                        className="underline"
                        href={`https://${source.repo}/commit/${source.commit}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.commit}
                      </a>
                    </div>
                  )}
                  {source?.path && (
                    <div className="flex items-center" title="source path">
                      <Folder className="inline-block w-5 h-5 stroke-[1.5px] mr-2 text-gray-500 dark:stroke-gray-200" />
                      {source.path}
                    </div>
                  )}
                </div>
              </div>
              {wv && (
                <div>
                  <div className="font-light text-gray-600 dark:text-gray-200">Storage</div>
                  <div className="mt-1 space-y-2 text-gray-800 dark:text-gray-200">
                    <div className="flex items-center font-mono text-sm" title="CDN storage key">
                      <FolderKey className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                      {wv.cdn_key}
                    </div>
                    <div
                      className="flex items-center font-mono text-sm"
                      title="CDN storage location"
                    >
                      <Server className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                      {wv.cdn}
                    </div>
                    {retentionPolicy && (
                      <div
                        className="flex items-center text-sm text-gray-600 dark:text-gray-200 text-light"
                        title="storage class and retention policy"
                      >
                        <FileClock className="inline-block w-5 h-5 stroke-[1.5px] mr-2 stroke-gray-500 dark:stroke-gray-200" />
                        {retentionPolicy}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden lg:flex">
              <PreviewAndArtifacts sv={sv} />
            </div>
          </div>
        </div>
      </div>
      {results.checks?.report && (
        <div className="w-full grow">
          <div className="w-full h-full max-w-[1280px] mx-auto flex flex-col items-center justify-center px-4 py-6 md:py-16 space-y-4 dark:text-gray-200">
            <div className="flex justify-start w-full">
              <div id="checks" className="text-xl font-semibold">
                Checks
              </div>
            </div>
            <ThemeProvider theme={mystTheme} setTheme={() => ({})} renderers={DEFAULT_RENDERERS}>
              <Checks
                className="w-full"
                date_created={job.date_created}
                results={results.checks?.report ?? []}
              />
            </ThemeProvider>
          </div>
        </div>
      )}
      <div className="w-full grow bg-curvenote-blue dark:bg-gray-900">
        <div className="w-full h-full max-w-[1280px] mx-auto flex flex-col items-center justify-center px-4 py-8 space-y-4">
          <div className="flex justify-center">
            <CurvenoteText fill="#ffffff" />
          </div>
        </div>
      </div>
    </div>
  );
}
