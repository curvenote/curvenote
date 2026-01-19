import type { Route } from './+types/route.system.storage';
import { data, Link, useFetcher } from 'react-router';
import classNames from 'classnames';
import {
  Folder,
  File,
  withAppAdminContext,
  getPrismaClient,
  StorageBackend,
  sites as sitesLoader,
} from '@curvenote/scms-server';
import {
  KnownBuckets,
  SystemAdminBadge,
  ui,
  primitives,
  formatDate,
  PageFrame,
  useDeploymentConfig,
} from '@curvenote/scms-core';
import type { Context, KnownBucketInfo } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import pLimit from 'p-limit';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppAdminContext(args);
  const backend = new StorageBackend(ctx);
  const summary = backend.summarise();
  const sites = await sitesLoader.list(ctx);
  return { summary, sites };
}

async function dbListAllSubmissions(siteName: string) {
  const prisma = await getPrismaClient();
  return prisma.submission.findMany({
    where: {
      site: { is: { id: siteName } },
    },
    include: {
      kind: true,
      site: { include: { submissionKinds: true } },
      versions: {
        include: {
          work_version: true,
        },
        orderBy: {
          date_created: 'desc',
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
  });
}

async function actionQueryByKey(ctx: Context, formData: FormData) {
  const path = formData.get('path');

  if (typeof path !== 'string' || path.length === 0) {
    return data({ error: 'Invalid cdn key or path' }, { status: 400 });
  }

  const backend = new StorageBackend(ctx);

  const locations = await Promise.all(
    backend.cdns.map(async (cdn: string) => {
      const folder = new Folder(backend, `${path}/`, backend.knownBucketFromCDN(cdn));
      const contents = await folder.contents();
      if (contents.length > 0) {
        const md5 = await folder.md5();
        return { cdn, path, md5, exists: true, isFolder: true, contents };
      }

      const file = new File(backend, path, backend.knownBucketFromCDN(cdn));
      const exists = await file.exists();
      if (!exists) {
        return { cdn, path, exists: false, isFolder: false, contents: [] };
      }

      const md5 = (await file.metadata()).md5Hash;
      return {
        cdn,
        path,
        md5,
        isFolder: false,
        exists,
        contents: [],
      };
    }),
  );

  return { locations };
}

async function actionManageSubmissions(ctx: Context, formData: FormData) {
  const siteId = formData.get('site_id');

  if (typeof siteId !== 'string' || siteId.length === 0) {
    return data({ error: 'Invalid siteId' }, { status: 400 });
  }

  const backend = new StorageBackend(ctx);

  const submissions = await dbListAllSubmissions(siteId);

  const limitS = pLimit(backend.concurrency);
  const limitV = pLimit(backend.concurrency);
  const subs = await Promise.all(
    submissions.map(async (s) =>
      limitS(async () => {
        const versions = await Promise.all(
          s.versions.map(async (v) =>
            limitV(async () => {
              const tmp = new Folder(backend, `${v.work_version.cdn_key}`, KnownBuckets.tmp);
              const cdn = new Folder(backend, `${v.work_version.cdn_key}`, KnownBuckets.cdn);
              const prv = new Folder(backend, `${v.work_version.cdn_key}`, KnownBuckets.prv);
              const pub = new Folder(backend, `${v.work_version.cdn_key}`, KnownBuckets.pub);

              const currentBucket = v.work_version.cdn
                ? backend.knownBucketFromCDN(v.work_version.cdn)
                : null;

              const locations = {
                tmp: await tmp.exists(),
                cdn: await cdn.exists(),
                prv: await prv.exists(),
                pub: await pub.exists(),
              };

              return {
                ...v,
                reference_cdn_warning:
                  currentBucket == null ||
                  !locations[currentBucket as 'tmp' | 'prv' | 'cdn' | 'pub'],
                can_publish: {
                  tmp:
                    currentBucket != null &&
                    v.work_version.cdn &&
                    backend.knownBucketFromCDN(v.work_version.cdn) !== KnownBuckets.tmp,
                  cdn:
                    currentBucket != null &&
                    v.work_version.cdn &&
                    backend.knownBucketFromCDN(v.work_version.cdn) !== KnownBuckets.cdn,
                  prv:
                    currentBucket != null &&
                    v.work_version.cdn &&
                    backend.knownBucketFromCDN(v.work_version.cdn) !== KnownBuckets.prv,
                  pub:
                    currentBucket != null &&
                    v.work_version.cdn &&
                    backend.knownBucketFromCDN(v.work_version.cdn) !== KnownBuckets.pub,
                },
                locations,
                links: {
                  tmp: `https://console.cloud.google.com/storage/browser/${backend.$bucketInfo['tmp'].uri}/${v.work_version.cdn_key}`,
                  cdn: `https://console.cloud.google.com/storage/browser/${backend.$bucketInfo['cdn'].uri}/${v.work_version.cdn_key}`,
                  prv: `https://console.cloud.google.com/storage/browser/${backend.$bucketInfo['prv'].uri}/${v.work_version.cdn_key}`,
                  pub: `https://console.cloud.google.com/storage/browser/${backend.$bucketInfo['pub'].uri}/${v.work_version.cdn_key}`,
                },
              };
            }),
          ),
        );

        return { ...s, versions };
      }),
    ),
  );

  return { submissions: subs };
}

async function actionPublishToCDN(ctx: Context, formData: FormData) {
  console.log('publishing to cdn', formData.get('work_version_id'));
  const work_version_id = formData.get('work_version_id');
  const from_cdn = formData.get('from_cdn');
  const to_bucket = formData.get('to_bucket');
  const from_bucket = formData.get('from_bucket');
  const key = formData.get('key');

  if (typeof from_cdn !== 'string' || from_cdn.length === 0) {
    return data({ error: 'Invalid from_cdn' }, { status: 400 });
  }
  if (typeof to_bucket !== 'string' || to_bucket.length === 0) {
    return data({ error: 'Invalid to_bucket' }, { status: 400 });
  }
  if (from_bucket !== null && (typeof from_bucket !== 'string' || from_bucket.length === 0)) {
    return data({ error: 'Invalid from_bucket' }, { status: 400 });
  }
  if (typeof work_version_id !== 'string' || work_version_id.length === 0) {
    return data({ error: 'Invalid work_version_id' }, { status: 400 });
  }
  if (typeof key !== 'string' || key.length === 0) {
    return data({ error: 'Invalid key' }, { status: 400 });
  }

  const backend = new StorageBackend(ctx);
  if (backend.knownBucketFromCDN(from_cdn) === null) {
    return data({ error: 'Unknown to_bucket' }, { status: 400 });
  }
  let knownBucket;
  switch (to_bucket) {
    case 'tmp':
      knownBucket = KnownBuckets.tmp;
      break;
    case 'cdn':
      knownBucket = KnownBuckets.cdn;
      break;
    case 'prv':
      knownBucket = KnownBuckets.prv;
      break;
    case 'pub':
      knownBucket = KnownBuckets.pub;
      break;
    default:
      return data({ error: 'Unknown to_bucket' }, { status: 400 });
  }

  try {
    const folder = new Folder(backend, `${key}`, backend.knownBucketFromCDN(from_cdn));
    await folder.copy({ bucket: knownBucket });
  } catch (e) {
    console.error(e);
    return data({ error: 'copy failed' }, { status: 400 });
  }

  return { copied: true };
}

async function actionUpdateCdnReference(ctx: Context, formData: FormData) {
  const new_cdn = formData.get('new_cdn');
  const key = formData.get('key');
  const work_version_id = formData.get('work_version_id');

  if (typeof new_cdn !== 'string' || new_cdn.length === 0) {
    return data({ error: 'Invalid new_cdn' }, { status: 400 });
  }
  if (typeof work_version_id !== 'string' || work_version_id.length === 0) {
    return data({ error: 'Invalid work_version_id' }, { status: 400 });
  }
  if (typeof key !== 'string' || key.length === 0) {
    return data({ error: 'Invalid key' }, { status: 400 });
  }

  const backend = new StorageBackend(ctx);

  const newBucket = backend.knownBucketFromCDN(new_cdn);

  const tmp = new Folder(backend, `${key}`, KnownBuckets.tmp);
  const cdn = new Folder(backend, `${key}`, KnownBuckets.cdn);
  const prv = new Folder(backend, `${key}`, KnownBuckets.prv);
  const pub = new Folder(backend, `${key}`, KnownBuckets.pub);

  const locations = {
    tmp: await tmp.exists(),
    cdn: await cdn.exists(),
    prv: await prv.exists(),
    pub: await pub.exists(),
  };

  const warning = newBucket == null || !locations[newBucket as 'tmp' | 'prv' | 'cdn' | 'pub'];

  const prisma = await getPrismaClient();
  await prisma.workVersion.update({
    where: {
      id: work_version_id,
    },
    data: {
      cdn: new_cdn,
      date_modified: new Date().toISOString(),
    },
  });

  return { cdn: new_cdn, warning };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppAdminContext(args);

  const formData = await args.request.formData();
  const formAction = formData.get('action');

  if (typeof formAction !== 'string') throw data({ error: 'Invalid form action' }, { status: 400 });

  if (formAction === 'query-by-key') {
    return actionQueryByKey(ctx, formData);
  } else if (formAction === 'manage-submissions') {
    return actionManageSubmissions(ctx, formData);
  } else if (formAction === 'publish-to-cdn') {
    return actionPublishToCDN(ctx, formData);
  } else if (formAction === 'update-cdn-reference') {
    return actionUpdateCdnReference(ctx, formData);
  }

  return null;
}

function StorageInfo({ info }: { info: Record<KnownBuckets, KnownBucketInfo> }) {
  return (
    <table className="p-2 my-4 text-sm text-left text-gray-500 table-auto dark:text-gray-400 border-[1px] pointer-events-none">
      <thead className="text-xs text-gray-700 uppercase bg-gray-200 dark:bg-gray-700 dark:text-gray-400">
        <tr className="border-b dark:bg-gray-800 dark:border-gray-700">
          <th className="px-4 py-1 text-center">name</th>
          <th className="px-4 py-1">bucket uri</th>
          <th className="px-4 py-1">cdn</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(info).map(([name, { uri, cdn }]) => (
          <tr className="even:bg-stone-100 dark:even:bg-stone-700" key={name}>
            <td className="px-4 py-1 text-center">{name}</td>
            <td className="px-4 py-1">{uri}</td>
            <td className={classNames('px-4 py-1', { 'text-center': !cdn })}>{cdn ?? '---'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Contents({ contents, limit = 50 }: { contents: string[]; limit?: number }) {
  return (
    <div className="font-mono text-xs">
      <div className="font-bold">contents:</div>
      {contents.length > limit && (
        <div className="pl-4 py1 font-xs">{`only showing first ${limit} files...`}</div>
      )}
      {contents.slice(0, limit).map((c) => (
        <div key={c} className="pl-4 py1">
          {c}
        </div>
      ))}
    </div>
  );
}

// type StorageLocation = {
//   cdn: string;
//   path: string;
//   md5: string;
//   isFolder: boolean;
//   exists: boolean;
//   contents: string[];
// };

function QueryByKeyUI() {
  const fetcher = useFetcher<typeof action>();

  // const data = fetcher.data as null | { error?: string; locations?: StorageLocation[] };
  const locations = fetcher.data && 'locations' in fetcher.data ? fetcher.data.locations : [];
  const hits = locations.filter(({ exists }) => exists);
  const error = fetcher.data && 'error' in fetcher.data ? fetcher.data.error : undefined;
  const md5s = hits.filter(({ md5 }) => !!md5).map(({ md5 }) => md5);
  const md5Mismatch = md5s.length > 1 && new Set(md5s).size > 1;

  return (
    <div>
      <h2 className="text-xl font-semibold">Query Storage Path</h2>
      <fetcher.Form className="py-4 space-y-2 max-w-lg" method="POST">
        <input type="hidden" name="action" value="query-by-key" />
        <primitives.TextField
          id="path"
          name="path"
          label={'Enter any cdn key or storage path prefix'}
          required
          error={error}
        />
        <ui.StatefulButton
          variant="secondary"
          type="submit"
          disabled={fetcher.state === 'loading'}
          busy={fetcher.state === 'submitting'}
          overlayBusy
        >
          Search
        </ui.StatefulButton>
      </fetcher.Form>
      {hits.length > 1 && (
        <div
          className={classNames({ 'text-green-600': !md5Mismatch, 'text-red-600': md5Mismatch })}
        >
          Multiple locations found {md5Mismatch ? ', md5 does not match 👎' : ', md5 match 👍'}
        </div>
      )}
      {locations && locations.length > 0 && (
        <div className="text-sm border-gray-400 divide-y divide-solid">
          {locations.map(({ cdn, md5, isFolder, contents, exists }) => (
            <div
              key={cdn}
              className={classNames('p-2 space-y-1', {
                'text-gray-500 bg-gray-100': !exists,
                'bg-green-100': exists,
              })}
            >
              <div className="font-mono">{`${cdn} ${exists ? `found ${isFolder ? `folder containing ${contents.length} files` : 'a file'} ` : 'nothing found'}`}</div>
              {md5 && <div className="font-mono text-xs font-bold">{`md5: ${md5}`}</div>}
              {contents.length > 0 && <Contents contents={contents} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferenceCdn({
  cdn,
  cdnKey,
  workVersionId: work_version_id,
  warning,
}: {
  cdn?: string;
  cdnKey?: string;
  workVersionId: string;
  warning: boolean;
}) {
  const fetcher = useFetcher<typeof action>();
  const updatedCdn = fetcher.data && 'cdn' in fetcher.data ? fetcher.data.cdn : undefined;
  const updatedWarning =
    fetcher.data && 'warning' in fetcher.data ? fetcher.data.warning : undefined;

  const handleClick = () => {
    const newCdn = prompt('Enter new CDN reference', updatedCdn ?? cdn);
    if (cdn == null || cdnKey == null || newCdn == null) return;

    try {
      new URL(newCdn);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      alert(`Invalid URL ${newCdn}`);
    }

    fetcher.submit(
      {
        new_cdn: newCdn,
        key: cdnKey,
        work_version_id,
        action: 'update-cdn-reference',
      },
      {
        method: 'POST',
      },
    );
  };
  return (
    <span
      className={classNames('underline cursor-pointer', {
        'font-semibold text-red-500': updatedWarning || warning,
      })}
      onClick={handleClick}
    >
      {updatedCdn ?? cdn ?? '---'}
    </span>
  );
}

function CopyToCDN({
  workVersion: wv,
  toBucket,
  fromBucket,
}: {
  workVersion: Awaited<ReturnType<typeof dbListAllSubmissions>>[0]['versions'][0]['work_version'];
  toBucket: string;
  fromBucket?: string;
}) {
  const fetcher = useFetcher<typeof action>();
  const copied = fetcher.data && 'copied' in fetcher.data ? fetcher.data.copied : undefined;
  const error = fetcher.data && 'error' in fetcher.data ? fetcher.data.error : undefined;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      confirm(
        `Are you sure you want to copy these files "${fromBucket ?? wv.cdn}" to "${toBucket}"?`,
      )
    ) {
      fetcher.submit(
        {
          work_version_id: wv.id,
          key: wv.cdn_key,
          from_cdn: wv.cdn,
          from_bucket: fromBucket ?? null,
          to_bucket: toBucket,
          action: 'publish-to-cdn',
        },
        {
          method: 'POST',
        },
      );
    }
  };

  return (
    <fetcher.Form method="POST" onSubmit={handleSubmit}>
      {copied ? (
        <span className="font-bold text-green-600">copied</span>
      ) : (
        <button className="underline opacity-80 cursor-pointer hover:opacity-100">
          copy to here
        </button>
      )}
      {error && <div className="text-xs text-red-600">{error}</div>}
    </fetcher.Form>
  );
}

function Versions({
  versions,
  site,
}: {
  versions: (Awaited<ReturnType<typeof dbListAllSubmissions>>[0]['versions'][0] & {
    reference_cdn_warning: boolean;
    can_publish: {
      tmp: boolean;
      cdn: boolean;
      prv: boolean;
      pub: boolean;
    };
    locations: {
      tmp: boolean;
      cdn: boolean;
      prv: boolean;
      pub: boolean;
    };
    links: {
      tmp: string;
      cdn: string;
      prv: string;
      pub: string;
    };
  })[];
  site: Awaited<ReturnType<typeof sitesLoader.list>>['items'][0];
}) {
  const config = useDeploymentConfig();
  return (
    <table className="py-1 my-1 table-auto *:border-[1px] *:border-gray-600">
      <thead>
        <tr className="*:border-[1px] *:border-gray-600">
          <th className="px-2 py-1">LINK</th>
          <th className="px-2 py-1">STATUS</th>
          <th className="px-2 py-1 text-center">TMP</th>
          <th className="px-2 py-1 text-center">CDN</th>
          <th className="px-2 py-1 text-center">PRV</th>
          <th className="px-2 py-1 text-center">PUB</th>
          <th className="px-2 py-1">CREATED</th>
          <th className="px-2 py-1">CDN</th>
          <th className="px-2 py-1">KEY</th>
          <th className="px-2 py-1">ID</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((v) => {
          let fromBucket = 'tmp';
          if (v.locations.prv) {
            fromBucket = 'prv';
          } else if (v.locations.cdn) {
            fromBucket = 'cdn';
          }

          return (
            <tr key={v.id} className="*:border-[1px] *:border-gray-600">
              <td className="px-2 py-1 text-center underline text-bold">
                <a
                  href={`${config.renderServiceUrl || site.links.html}/articles/${v.work_version.work_id}`}
                  target="_blank"
                >
                  work
                </a>
              </td>
              <td className="px-2 py-1 text-bold">{v.status}</td>
              <td className="px-2 py-1 text-center">
                {v.locations.tmp ? (
                  <span className="font-bold text-green-600 underline">
                    <a href={v.links.tmp} target="_blank">
                      found
                    </a>
                  </span>
                ) : (
                  '-'
                )}
              </td>
              <td className="px-2 py-1 text-center">
                {v.locations.cdn ? (
                  <span className="font-bold text-green-600 underline">
                    <a href={v.links.cdn} target="_blank">
                      found
                    </a>
                  </span>
                ) : (
                  '-'
                )}
              </td>
              <td className="px-2 py-1 text-center">
                {v.locations.prv ? (
                  <span className="font-bold text-green-600 underline">
                    <a href={v.links.prv} target="_blank">
                      found
                    </a>
                  </span>
                ) : v.can_publish.prv ? (
                  <CopyToCDN workVersion={v.work_version} fromBucket={fromBucket} toBucket="prv" />
                ) : (
                  '-'
                )}
              </td>
              <td className="px-2 py-1 text-center">
                {v.locations.pub ? (
                  <span className="font-bold text-green-600 underline">
                    <a href={v.links.pub} target="_blank">
                      found
                    </a>
                  </span>
                ) : v.can_publish.pub ? (
                  <CopyToCDN workVersion={v.work_version} fromBucket={fromBucket} toBucket="pub" />
                ) : (
                  '-'
                )}
              </td>
              <td className="px-2 py-1">{formatDate(v.date_created)}</td>
              <td className="px-2 py-1">
                <ReferenceCdn
                  cdn={v.work_version.cdn ?? undefined}
                  cdnKey={v.work_version.cdn_key ?? undefined}
                  workVersionId={v.work_version_id}
                  warning={v.reference_cdn_warning}
                />
              </td>
              <td className="px-2 py-1">{v.work_version.cdn_key}</td>
              <td className="px-2 py-1">{v.id}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ManageSubmissions({ sites }: { sites: Awaited<ReturnType<typeof sitesLoader.list>> }) {
  const fetcher = useFetcher<typeof action>();
  const submissions = fetcher.data && 'submissions' in fetcher.data ? fetcher.data.submissions : [];

  return (
    <div>
      <h2 className="text-xl font-semibold">Manage Submission Storage</h2>
      <fetcher.Form className="py-4 space-x-2 max-w-lg" method="POST">
        <input type="hidden" name="action" value="manage-submissions" />
        <select className="bg-stone-50 dark:bg-stone-900" name="site_id">
          <option value="">Select a site</option>
          {sites.items.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
        <ui.StatefulButton
          variant="secondary"
          type="submit"
          disabled={fetcher.state === 'loading'}
          busy={fetcher.state === 'submitting'}
          overlayBusy
        >
          Search
        </ui.StatefulButton>
      </fetcher.Form>
      {submissions?.length === 0 && <div>No submissions found</div>}
      {submissions.length > 0 && (
        <div className="text-sm border-gray-400 divide-y divide-solid">
          {submissions.map((s) => (
            <div
              key={s.id}
              className={classNames('p-2 space-y-1 odd:bg-green-100 even:bg-green-50')}
            >
              <div className="font-mono">
                <span>
                  submission:{' '}
                  <Link className="underline" to={`/app/sites/${s.site.name}/submissions/${s.id}`}>
                    {s.id}
                  </Link>{' '}
                  created: {formatDate(s.date_created)} num versions {s.versions.length}
                </span>
              </div>
              <Versions
                versions={s.versions as any}
                site={sites.items.find((site) => site.id === s.site_id)!}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StorageAdminPanel({ loaderData }: Route.ComponentProps) {
  const {
    summary: { info },
    sites,
  } = loaderData as {
    summary: { info: Record<KnownBuckets, KnownBucketInfo> };
    sites: Awaited<ReturnType<typeof sitesLoader.list>>;
  };

  return (
    <PageFrame title="Storage Administration">
      <SystemAdminBadge />
      <div className="py-4">
        <h2 className="text-xl font-semibold">Storage Configuration</h2>
        <StorageInfo info={info} />
        <QueryByKeyUI />
        <ManageSubmissions sites={sites} />
      </div>
    </PageFrame>
  );
}
