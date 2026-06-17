import type { Route } from './+types/route';
import { data, useFetcher, useRevalidator } from 'react-router';
import { useState } from 'react';
import {
  withAppAdminContext,
  getJobQueueDrainStatus,
  getJobQueueTail,
  setJobQueueDrainUrl,
  pushJobQueueDrainSecretFromConfig,
  type JobQueueDrainStatus,
  type JobQueueTail,
} from '@curvenote/scms-server';
import { PageFrame, ui } from '@curvenote/scms-core';
import {
  Radio,
  KeyRound,
  Link2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  PlayCircle,
} from 'lucide-react';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Queues - System Admin' },
    { name: 'description', content: 'Job queue drain configuration and monitoring' },
  ];
};

type DrainStatusResult = { ok: true; status: JobQueueDrainStatus } | { ok: false; error: string };

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args);

  let drainStatus: DrainStatusResult;
  try {
    drainStatus = { ok: true, status: await getJobQueueDrainStatus() };
  } catch (err) {
    drainStatus = {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to read drain config',
    };
  }

  const tail = await getJobQueueTail();

  return { drainStatus, tail };
}

export async function action(args: Route.ActionArgs) {
  await withAppAdminContext(args);
  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  try {
    if (intent === 'update-endpoint') {
      const url = (formData.get('url') as string) ?? '';
      await setJobQueueDrainUrl(url);
      return data({ ok: true, intent });
    }

    if (intent === 'push-secret') {
      await pushJobQueueDrainSecretFromConfig();
      return data({ ok: true, intent });
    }

    return data({ ok: false, error: 'Unknown intent' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Action failed';
    return data({ ok: false, intent, error: message }, { status: 500 });
  }
}

// ─── Drain config ────────────────────────────────────────────────────

function SecretStatus({ status }: { status: JobQueueDrainStatus }) {
  if (!status.hasSecret) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
        <XCircle className="w-3.5 h-3.5" /> Not set
      </span>
    );
  }
  if (status.secretMatchesAppConfig) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
        <CheckCircle className="w-3.5 h-3.5" /> Matches app-config
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">
      <AlertTriangle className="w-3.5 h-3.5" /> Differs from app-config
    </span>
  );
}

function DrainConfigPanel({ status }: { status: JobQueueDrainStatus }) {
  const urlFetcher = useFetcher<{ ok: boolean; intent?: string; error?: string }>();
  const secretFetcher = useFetcher<{ ok: boolean; intent?: string; error?: string }>();
  const [url, setUrl] = useState(status.drainUrl ?? status.defaultDrainUrl);

  const urlBusy = urlFetcher.state !== 'idle';
  const secretBusy = secretFetcher.state !== 'idle';

  return (
    <section className="overflow-hidden bg-white rounded-lg border">
      <div className="flex gap-2 items-center px-4 py-3 bg-gray-50 border-b">
        <KeyRound className="w-4 h-4 text-gray-600" />
        <h2 className="text-lg font-semibold">Drain config</h2>
      </div>
      <div className="p-4 space-y-5 text-sm">
        <p className="text-gray-600">
          The <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">_JobQueueDrainConfig</code>{' '}
          row tells the Postgres enqueue trigger (pg_net) and the pg_cron backup where to wake the
          consumer and which secret to send. It must be populated for jobs to drain promptly under
          the <span className="font-medium">supabase</span> provider.
        </p>

        {/* Endpoint */}
        <urlFetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="update-endpoint" />
          <ui.Label htmlFor="drain-url" className="flex gap-1.5 items-center">
            <Link2 className="w-3.5 h-3.5" /> Drain endpoint
          </ui.Label>
          <div className="flex gap-2 items-start">
            <ui.Input
              id="drain-url"
              name="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={status.defaultDrainUrl}
              className="max-w-xl font-mono text-xs"
            />
            <ui.Button type="submit" disabled={urlBusy || !url.trim()}>
              {urlBusy ? 'Saving…' : 'Save endpoint'}
            </ui.Button>
          </div>
          <p className="text-xs text-gray-500">
            Default from app-config:{' '}
            <code className="bg-gray-100 px-1 rounded">{status.defaultDrainUrl}</code>
          </p>
          {urlFetcher.data && !urlFetcher.data.ok && (
            <p className="text-xs text-red-600">{urlFetcher.data.error}</p>
          )}
          {urlFetcher.data?.ok && urlFetcher.data.intent === 'update-endpoint' && (
            <p className="text-xs text-green-600">Endpoint saved.</p>
          )}
        </urlFetcher.Form>

        {/* Secret */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex gap-2 items-center">
            <span className="font-medium text-gray-500">Secret</span>
            <SecretStatus status={status} />
            <span className="font-mono text-xs text-gray-400">
              stored {status.secretLength} chars · config {status.appConfigSecretLength} chars
            </span>
          </div>
          <secretFetcher.Form method="post">
            <input type="hidden" name="intent" value="push-secret" />
            <ui.Button type="submit" variant="outline" disabled={secretBusy}>
              <KeyRound className="w-4 h-4 mr-1.5" />
              {secretBusy ? 'Pushing…' : 'Push secret from app-config'}
            </ui.Button>
          </secretFetcher.Form>
          {secretFetcher.data && !secretFetcher.data.ok && (
            <p className="text-xs text-red-600">{secretFetcher.data.error}</p>
          )}
          {secretFetcher.data?.ok && secretFetcher.data.intent === 'push-secret' && (
            <p className="text-xs text-green-600">Secret pushed from app-config.</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Queue tail ──────────────────────────────────────────────────────

function StateBadge({ inFlight }: { inFlight: boolean }) {
  if (inFlight) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
        <PlayCircle className="w-3 h-3" /> in-flight
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
      <Clock className="w-3 h-3" /> pending
    </span>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function QueueTailPanel({ tail }: { tail: JobQueueTail }) {
  const revalidator = useRevalidator();
  const refreshing = revalidator.state !== 'idle';

  return (
    <section className="overflow-hidden bg-white rounded-lg border">
      <div className="flex gap-2 justify-between items-center px-4 py-3 bg-gray-50 border-b">
        <div className="flex gap-2 items-center">
          <Radio className="w-4 h-4 text-gray-600" />
          <h2 className="text-lg font-semibold">Queue tail</h2>
          <span className="font-mono text-xs text-gray-500">
            provider {tail.provider}
            {tail.depth != null ? ` · depth ${tail.depth}` : ''}
          </span>
        </div>
        <ui.Button variant="ghost" onClick={() => revalidator.revalidate()} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </ui.Button>
      </div>

      <div className="p-4 text-sm">
        {!tail.supported && (
          <p className="text-gray-500">
            The active provider ({tail.provider}) does not expose a queue tail.
          </p>
        )}
        {tail.error && (
          <p className="text-red-600">
            Could not read the queue: <span className="font-mono text-xs">{tail.error}</span>
          </p>
        )}
        {tail.supported && !tail.error && tail.entries.length === 0 && (
          <p className="text-gray-500">Queue is empty — no pending or in-flight messages.</p>
        )}
        {tail.supported && tail.entries.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Msg
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Job type
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Job id
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Enqueued
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                    Reads
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    State
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tail.entries.map((entry) => (
                  <tr key={entry.messageId}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{entry.messageId}</td>
                    <td className="px-3 py-2 font-mono text-sm">{entry.jobType}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{entry.jobId}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimestamp(entry.enqueuedAt)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums">
                      {entry.deliveryCount}
                    </td>
                    <td className="px-3 py-2">
                      <StateBadge inFlight={entry.inFlight} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function SystemQueuesPage({ loaderData }: Route.ComponentProps) {
  const { drainStatus, tail } = loaderData;

  return (
    <PageFrame
      title="Queues"
      description="Configure the job queue drain wake and monitor pending messages."
    >
      <div className="space-y-8">
        {drainStatus.ok ? (
          <DrainConfigPanel status={drainStatus.status} />
        ) : (
          <section className="p-4 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
            Could not read drain config:{' '}
            <span className="font-mono text-xs">{drainStatus.error}</span>
          </section>
        )}

        <QueueTailPanel tail={tail} />
      </div>
    </PageFrame>
  );
}
