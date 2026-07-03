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
  CronEndpointScopes,
  type CronTickStatus,
  type PgCronHealth,
} from '@curvenote/scms-server';
import { PageFrame, ui } from '@curvenote/scms-core';
import type { CronJob } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';
import {
  Clock,
  KeyRound,
  Link2,
  PlayCircle,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

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
  return { jobs, tickStatus, pgCronHealth };
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

function JobsTab({ jobs }: { jobs: CronJob[] }) {
  const runFetcher = useFetcher();
  const toggleFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const createFetcher = useFetcher();

  return (
    <div className="space-y-6">
      <section className="overflow-hidden bg-white rounded-lg border">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold">Cron jobs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Schedule</th>
                <th className="px-3 py-2 text-left">Next run</th>
                <th className="px-3 py-2 text-left">Last</th>
                <th className="px-3 py-2 text-left">Scope</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-3 py-2 font-mono">{job.name}</td>
                  <td className="px-3 py-2">{job.schedule}</td>
                  <td className="px-3 py-2 text-xs">{job.next_run_at ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {job.last_status ?? '—'}
                    {job.last_error ? ` (${job.last_error.slice(0, 40)})` : ''}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{job.target_scope ?? '—'}</td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <runFetcher.Form method="post" className="inline">
                      <input type="hidden" name="intent" value="run-now" />
                      <input type="hidden" name="id" value={job.id} />
                      <ui.Button type="submit" size="sm" variant="outline">
                        <PlayCircle className="w-3.5 h-3.5" />
                      </ui.Button>
                    </runFetcher.Form>
                    <toggleFetcher.Form method="post" className="inline">
                      <input type="hidden" name="intent" value="toggle" />
                      <input type="hidden" name="id" value={job.id} />
                      <input type="hidden" name="enabled" value={String(!job.enabled)} />
                      <ui.Button type="submit" size="sm" variant="ghost">
                        {job.enabled ? 'Disable' : 'Enable'}
                      </ui.Button>
                    </toggleFetcher.Form>
                    <deleteFetcher.Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={job.id} />
                      <ui.Button type="submit" size="sm" variant="ghost">
                        <Trash2 className="w-3.5 h-3.5" />
                      </ui.Button>
                    </deleteFetcher.Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="p-4 bg-white rounded-lg border">
        <h3 className="mb-3 font-semibold">Create HTTP cron (HANDSHAKE)</h3>
        <createFetcher.Form method="post" className="grid gap-3 max-w-xl">
          <input type="hidden" name="intent" value="create" />
          <ui.Input name="name" placeholder="name (unique)" required />
          <ui.Input name="schedule" placeholder="cron expr e.g. * * * * *" required />
          <ui.Input name="http_method" placeholder="POST" defaultValue="POST" />
          <ui.Input name="target_url" placeholder="https://host/v1/..." required />
          <ui.Input
            name="target_scope"
            placeholder={`scope (default: ${CronEndpointScopes.JOB_QUEUE_DRAIN})`}
          />
          <ui.Button type="submit">Create</ui.Button>
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
          setSearchParams(v === 'jobs' ? {} : { tab: v }, { replace: true, preventScrollReset: true })
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
