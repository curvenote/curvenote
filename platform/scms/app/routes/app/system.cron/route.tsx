import type { Route } from './+types/route';
import { data, useFetcher, useSearchParams } from 'react-router';
import { useState } from 'react';
import {
  withAppAdminContext,
  dbListCronJobs,
  dbCreateCronJob,
  dbDeleteCronJob,
  dbSetCronJobEnabled,
  runCronJobNow,
  getCronTickStatus,
  getPgCronHealth,
  setCronTickUrl,
  pushCronTickSecretFromConfig,
  unscheduleJobQueueDrainBackup,
  rescheduleJobQueueDrainBackup,
  CronJobTargetType,
  CronJobTargetAuth,
  cronEndpointScope,
  resolveScopedCronTargetUrl,
  getConfig,
  type CronTickStatus,
  type PgCronHealth,
} from '@curvenote/scms-server';
import { CronEndpointScopes, PageFrame, ui } from '@curvenote/scms-core';
import type { CronJob } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';
import { Clock, KeyRound, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { CronJobListItem } from './CronJobListItem';
import type { CronJobListRow } from './types';

async function enrichCronJobsForList(jobs: CronJob[]): Promise<CronJobListRow[]> {
  const config = await getConfig();
  return jobs.map((job) => {
    let resolvedTargetUrl: string | null = job.target_url;
    if (!resolvedTargetUrl && job.target_scope) {
      try {
        resolvedTargetUrl = resolveScopedCronTargetUrl(job.target_scope, config.api);
      } catch {
        resolvedTargetUrl = null;
      }
    }
    return { ...job, resolvedTargetUrl };
  });
}

export const meta: Route.MetaFunction = () => [
  { title: 'Cron - System Admin' },
  { name: 'description', content: 'Manage scheduled cron jobs and tick configuration' },
];

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args);
  const [jobs, tickStatus, pgCronHealth] = await Promise.all([
    dbListCronJobs(),
    getCronTickStatus(),
    getPgCronHealth(),
  ]);
  return { jobs: await enrichCronJobsForList(jobs), tickStatus, pgCronHealth };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppAdminContext(args);
  const form = await args.request.formData();
  const intent = String(form.get('intent') ?? '');

  try {
    if (intent === 'create') {
      const name = String(form.get('name') ?? '').trim();
      const schedule = String(form.get('schedule') ?? '').trim();
      const targetUrl = String(form.get('target_url') ?? '').trim();
      const httpMethod = String(form.get('http_method') ?? 'POST').trim();
      const targetScope =
        String(form.get('target_scope') ?? '').trim() ||
        (targetUrl ? cronEndpointScope(httpMethod, new URL(targetUrl).pathname) : '');
      await dbCreateCronJob(uuidv7(), {
        name,
        schedule,
        target_type: CronJobTargetType.HTTP,
        target_url: targetUrl || null,
        http_method: httpMethod,
        target_auth: CronJobTargetAuth.HANDSHAKE,
        target_scope: targetScope,
        created_by: ctx.user?.id,
      });
      return data({ ok: true, intent });
    }

    if (intent === 'toggle') {
      const id = String(form.get('id'));
      const enabled = form.get('enabled') === 'true';
      await dbSetCronJobEnabled(id, enabled);
      return data({ ok: true, intent });
    }

    if (intent === 'run-now') {
      const id = String(form.get('id'));
      await runCronJobNow(id);
      return data({ ok: true, intent });
    }

    if (intent === 'delete') {
      await dbDeleteCronJob(String(form.get('id')));
      return data({ ok: true, intent });
    }

    if (intent === 'update-endpoint') {
      await setCronTickUrl(String(form.get('url') ?? ''));
      return data({ ok: true, intent });
    }

    if (intent === 'push-secret') {
      await pushCronTickSecretFromConfig();
      return data({ ok: true, intent });
    }

    if (intent === 'cutover-drain-backup') {
      await unscheduleJobQueueDrainBackup();
      return data({ ok: true, intent });
    }

    if (intent === 'restore-drain-backup') {
      await rescheduleJobQueueDrainBackup();
      return data({ ok: true, intent });
    }
  } catch (err) {
    return data(
      { ok: false, intent, error: err instanceof Error ? err.message : 'Action failed' },
      { status: 500 },
    );
  }

  return data({ ok: false, error: 'Unknown intent' }, { status: 400 });
}

function SecretStatus({ status }: { status: CronTickStatus }) {
  if (!status.hasSecret) {
    return (
      <span className="inline-flex gap-1 items-center px-2 py-0.5 text-sm font-medium text-red-700 bg-red-50 rounded">
        <XCircle className="w-3.5 h-3.5" /> Not set
      </span>
    );
  }
  if (status.secretMatchesAppConfig) {
    return (
      <span className="inline-flex gap-1 items-center px-2 py-0.5 text-sm font-medium text-green-700 bg-green-50 rounded">
        <CheckCircle className="w-3.5 h-3.5" /> Matches app-config
      </span>
    );
  }
  return (
    <span className="inline-flex gap-1 items-center px-2 py-0.5 text-sm font-medium text-yellow-700 bg-yellow-50 rounded">
      <AlertTriangle className="w-3.5 h-3.5" /> Differs from app-config
    </span>
  );
}

function ConfigTab({
  tickStatus,
  pgCronHealth,
}: {
  tickStatus: CronTickStatus;
  pgCronHealth: PgCronHealth;
}) {
  const [url, setUrl] = useState(tickStatus.tickUrl ?? tickStatus.defaultTickUrl);
  const urlFetcher = useFetcher();
  const secretFetcher = useFetcher();
  const cutoverFetcher = useFetcher();

  return (
    <div className="space-y-6">
      <section className="overflow-hidden bg-white rounded-lg border">
        <div className="flex gap-2 items-center px-4 py-3 bg-gray-50 border-b">
          <KeyRound className="w-4 h-4" />
          <h2 className="text-lg font-semibold">Tick config</h2>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <urlFetcher.Form method="post" className="space-y-2">
            <input type="hidden" name="intent" value="update-endpoint" />
            <ui.Label htmlFor="tick-url">Tick endpoint</ui.Label>
            <div className="flex gap-2">
              <ui.Input
                id="tick-url"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-xs max-w-xl"
              />
              <ui.Button type="submit">Save</ui.Button>
            </div>
            <p className="text-xs text-gray-500">Default: {tickStatus.defaultTickUrl}</p>
          </urlFetcher.Form>
          <div className="flex gap-2 items-center pt-2 border-t">
            <SecretStatus status={tickStatus} />
            <secretFetcher.Form method="post">
              <input type="hidden" name="intent" value="push-secret" />
              <ui.Button type="submit" variant="outline" size="sm">
                Push secret from app-config
              </ui.Button>
            </secretFetcher.Form>
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-white rounded-lg border">
        <div className="flex gap-2 items-center px-4 py-3 bg-gray-50 border-b">
          <Clock className="w-4 h-4" />
          <h2 className="text-lg font-semibold">pg_cron health</h2>
        </div>
        <div className="p-4 space-y-2 text-sm">
          {!pgCronHealth.available && (
            <p className="text-red-600">pg_cron extension not available in this database.</p>
          )}
          {pgCronHealth.available && (
            <ul className="space-y-1">
              <li>cron-tick scheduled: {pgCronHealth.cronTickScheduled ? 'yes' : 'no'}</li>
              <li>cron-tick active: {String(pgCronHealth.cronTickActive)}</li>
              <li>last run: {pgCronHealth.lastRunAt ?? '—'}</li>
              <li>last status: {pgCronHealth.lastRunStatus ?? '—'}</li>
              <li>drain backup scheduled: {pgCronHealth.drainBackupScheduled ? 'yes' : 'no'}</li>
            </ul>
          )}
          <div className="flex gap-2 pt-2">
            <cutoverFetcher.Form method="post">
              <input type="hidden" name="intent" value="cutover-drain-backup" />
              <ui.Button type="submit" variant="outline" size="sm">
                Unschedule drain backup
              </ui.Button>
            </cutoverFetcher.Form>
            <cutoverFetcher.Form method="post">
              <input type="hidden" name="intent" value="restore-drain-backup" />
              <ui.Button type="submit" variant="ghost" size="sm">
                Restore drain backup
              </ui.Button>
            </cutoverFetcher.Form>
          </div>
        </div>
      </section>
    </div>
  );
}

function JobsTab({ jobs }: { jobs: CronJobListRow[] }) {
  const createFetcher = useFetcher();

  return (
    <div className="space-y-6">
      <section className="overflow-hidden bg-white rounded-lg border dark:bg-gray-900 dark:border-gray-700">
        <div className="px-4 py-3 bg-gray-50 border-b dark:bg-gray-800 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Cron jobs</h2>
        </div>
        {jobs.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-gray-500">No cron jobs configured.</p>
        ) : (
          <div>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-2 p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <CronJobListItem job={job} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="p-4 bg-white rounded-lg border dark:bg-gray-900 dark:border-gray-700">
        <h3 className="mb-3 font-semibold">Create HTTP cron (HANDSHAKE)</h3>
        <createFetcher.Form method="post" className="grid gap-4 max-w-xl">
          <input type="hidden" name="intent" value="create" />
          <div>
            <ui.Label htmlFor="cron-name">Name *</ui.Label>
            <ui.Input
              id="cron-name"
              name="name"
              placeholder="my-cron-job"
              required
              className="mt-1"
            />
            <p className="mt-1 text-sm text-muted-foreground">Unique identifier for this cron job</p>
          </div>
          <div>
            <ui.Label htmlFor="cron-schedule">Schedule *</ui.Label>
            <ui.Input
              id="cron-schedule"
              name="schedule"
              placeholder="* * * * *"
              required
              className="mt-1 font-mono"
            />
            <p className="mt-1 text-sm text-muted-foreground">Standard cron expression</p>
          </div>
          <div>
            <ui.Label htmlFor="cron-http-method">HTTP method</ui.Label>
            <ui.Input
              id="cron-http-method"
              name="http_method"
              defaultValue="POST"
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <ui.Label htmlFor="cron-target-url">Target URL *</ui.Label>
            <ui.Input
              id="cron-target-url"
              name="target_url"
              placeholder="https://host/v1/..."
              required
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <ui.Label htmlFor="cron-target-scope">Scope</ui.Label>
            <ui.Input
              id="cron-target-scope"
              name="target_scope"
              placeholder={CronEndpointScopes.JOB_QUEUE_DRAIN}
              className="mt-1 font-mono text-xs"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Optional. Defaults to {CronEndpointScopes.JOB_QUEUE_DRAIN} when left blank and a
              target URL is provided.
            </p>
          </div>
          <ui.Button type="submit" className="w-fit">
            Create
          </ui.Button>
        </createFetcher.Form>
      </section>
    </div>
  );
}

export default function SystemCronPage({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'config' ? 'config' : 'jobs';

  return (
    <PageFrame title="Cron" description="DB-driven cron jobs and master tick configuration.">
      <ui.Tabs
        value={tab}
        onValueChange={(v) =>
          setSearchParams(v === 'jobs' ? {} : { tab: v }, {
            replace: true,
            preventScrollReset: true,
          })
        }
      >
        <ui.TabsList>
          <ui.TabsTrigger value="jobs">Cron jobs</ui.TabsTrigger>
          <ui.TabsTrigger value="config">Config</ui.TabsTrigger>
        </ui.TabsList>
        <ui.TabsContent value="jobs" className="mt-4">
          <JobsTab jobs={loaderData.jobs} />
        </ui.TabsContent>
        <ui.TabsContent value="config" className="mt-4">
          <ConfigTab tickStatus={loaderData.tickStatus} pgCronHealth={loaderData.pgCronHealth} />
        </ui.TabsContent>
      </ui.Tabs>
    </PageFrame>
  );
}
