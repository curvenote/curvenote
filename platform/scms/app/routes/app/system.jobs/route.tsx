import type { Route } from './+types/route';
import { data, useFetcher, useRevalidator, useSearchParams } from 'react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  withAppAdminContext,
  registerExtensionJobs,
  getPrismaClient,
  enqueueAndDispatchJob,
  drainOneJob,
  getJobQueueDrainStatus,
  getJobQueueTail,
  setJobQueueDrainUrl,
  pushJobQueueDrainSecretFromConfig,
  dispatchJobWithHandshake,
  setJobQueueDrainPaused,
  notifyQueueConsumer,
  type JobQueueDrainStatus,
  type JobQueueTail,
} from '@curvenote/scms-server';
import { PageFrame, ui, KnownJobTypes } from '@curvenote/scms-core';
import {
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Radio,
  KeyRound,
  Link2,
  AlertTriangle,
  PlayCircle,
} from 'lucide-react';
import { extensions as serverExtensions } from '../../../extensions/server';
import { consumeJobQueueMessage } from '../../../lib/job-queue-consumer.server';
import { uuidv7 } from 'uuidv7';

/** Max messages a single "Drain now" click will process in-process before returning. */
const MAX_MANUAL_DRAIN = 10;
const STALE_QUEUED_JOB_REPAIR_MS = 2 * 60 * 1000;
const RECENT_JOBS_LIMIT = 25;

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Jobs - System Admin' },
    { name: 'description', content: 'Job queue testing and monitoring' },
  ];
};

type DrainStatusResult = { ok: true; status: JobQueueDrainStatus } | { ok: false; error: string };

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args);

  const coreJobTypes = Object.values(KnownJobTypes);
  const extensionJobTypes = registerExtensionJobs(serverExtensions).map((j) => j.jobType);
  const allJobTypes = [...coreJobTypes, ...extensionJobTypes];

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

  const prisma = await getPrismaClient();
  const recentJobsRows = await prisma.job.findMany({
    orderBy: { date_created: 'desc' },
    take: RECENT_JOBS_LIMIT,
    select: {
      id: true,
      job_type: true,
      status: true,
      date_created: true,
      date_modified: true,
      scheduled_at: true,
    },
  });

  return {
    jobTypes: allJobTypes,
    queue: {
      consumerRoute: '/v1/jobs/push-to-drain',
      queueName: 'job',
    },
    drainStatus,
    tail,
    recentJobs: recentJobsRows,
  };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppAdminContext(args);
  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'dispatch-loopback') {
    try {
      const jobId = uuidv7();
      const result = await enqueueAndDispatchJob({
        job_id: jobId,
        job_type: KnownJobTypes.LOOPBACK,
        payload: {},
        invoked_by_id: ctx.user?.id,
      });
      return data({ ok: true, job_id: result.job_id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enqueue failed';
      return data({ ok: false, error: message }, { status: 500 });
    }
  }

  if (intent === 'drain-now') {
    // Drain messages in-process (no pg_net / HTTP wake). This guarantees the
    // backlog clears even when the enqueue wake is misconfigured. Bounded so a
    // single click can't block the request indefinitely; click again to continue.
    let processed = 0;
    try {
      const drainStatus = await getJobQueueDrainStatus();
      if (drainStatus.paused) {
        return data({ ok: true, intent, processed, capped: false, paused: true });
      }
      while (processed < MAX_MANUAL_DRAIN) {
        const didWork = await drainOneJob(consumeJobQueueMessage);
        if (!didWork) break;
        processed += 1;
      }
      return data({ ok: true, intent, processed, capped: processed >= MAX_MANUAL_DRAIN });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Drain failed';
      return data({ ok: false, intent, processed, error: message }, { status: 500 });
    }
  }

  if (intent === 'redispatch-queued-job') {
    const jobId = formData.get('jobId') as string;
    if (!jobId) return data({ ok: false, intent, error: 'Missing jobId' }, { status: 400 });

    const prisma = await getPrismaClient();
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, job_type: true, status: true, date_modified: true },
    });
    if (!job) return data({ ok: false, intent, error: 'Job not found' }, { status: 404 });
    if (job.status !== 'QUEUED') {
      return data(
        { ok: false, intent, error: `Job is ${job.status}, not QUEUED` },
        { status: 400 },
      );
    }
    if (job.job_type === KnownJobTypes.CLI_CHECK) {
      return data(
        {
          ok: false,
          intent,
          error: 'CLI_CHECK jobs are tracked externally and cannot be redispatched',
        },
        { status: 400 },
      );
    }

    const modifiedAt = new Date(job.date_modified).getTime();
    if (Number.isNaN(modifiedAt) || Date.now() - modifiedAt < STALE_QUEUED_JOB_REPAIR_MS) {
      return data(
        { ok: false, intent, error: 'Queued job must be older than 2 minutes to redispatch' },
        { status: 400 },
      );
    }

    try {
      const { messageId } = await dispatchJobWithHandshake(job);
      return data({ ok: true, intent, job_id: job.id, messageId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Redispatch failed';
      return data({ ok: false, intent, error: message }, { status: 500 });
    }
  }

  if (intent === 'poll-job') {
    const jobId = formData.get('jobId') as string;
    if (!jobId) return data({ ok: false, error: 'Missing jobId' }, { status: 400 });
    const prisma = await getPrismaClient();
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return data({ ok: true, job: null });
    return data({
      ok: true,
      job: {
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        messages: job.messages,
        results: job.results,
        date_created: job.date_created,
        date_modified: job.date_modified,
      },
    });
  }

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

    if (intent === 'pause-drain') {
      await setJobQueueDrainPaused(true);
      return data({ ok: true, intent });
    }

    if (intent === 'resume-drain') {
      await setJobQueueDrainPaused(false);
      notifyQueueConsumer();
      return data({ ok: true, intent });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Action failed';
    return data({ ok: false, intent, error: message }, { status: 500 });
  }

  return data({ ok: false, error: 'Unknown intent' }, { status: 400 });
}

// ─── Status badge ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
          <CheckCircle className="w-3.5 h-3.5" /> COMPLETED
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
          <XCircle className="w-3.5 h-3.5" /> FAILED
        </span>
      );
    case 'RUNNING':
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> RUNNING
        </span>
      );
    case 'QUEUED':
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">
          <Clock className="w-3.5 h-3.5" /> QUEUED
        </span>
      );
    case 'SCHEDULED':
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
          <Clock className="w-3.5 h-3.5" /> SCHEDULED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
          {status}
        </span>
      );
  }
}

// ─── Loopback test component ─────────────────────────────────────────

function LoopbackTest() {
  const dispatchFetcher = useFetcher<{ ok: boolean; job_id?: string; error?: string }>();
  const pollFetcher = useFetcher<{
    ok: boolean;
    job?: {
      id: string;
      job_type: string;
      status: string;
      messages: string[];
      results: Record<string, unknown> | null;
      date_created: string | Date;
      date_modified: string | Date;
    } | null;
  }>();

  const [jobId, setJobId] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [jobState, setJobState] = useState<{
    status: string;
    messages: string[];
    results: Record<string, unknown> | null;
  } | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollSubmitRef = useRef(pollFetcher.submit);

  useEffect(() => {
    pollSubmitRef.current = pollFetcher.submit;
  }, [pollFetcher.submit]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (dispatchFetcher.data?.ok && dispatchFetcher.data.job_id) {
      setJobId(dispatchFetcher.data.job_id);
      setDispatching(false);
      setJobState({ status: 'DISPATCHED', messages: [], results: null });
    } else if (dispatchFetcher.data && !dispatchFetcher.data.ok) {
      setDispatching(false);
    }
  }, [dispatchFetcher.data]);

  useEffect(() => {
    if (pollFetcher.data?.ok && pollFetcher.data.job) {
      const job = pollFetcher.data.job;
      setJobState({
        status: job.status,
        messages: job.messages as string[],
        results: job.results as Record<string, unknown> | null,
      });
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        stopPolling();
      }
    }
  }, [pollFetcher.data, stopPolling]);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      const submitPoll = () => {
        const formData = new FormData();
        formData.set('intent', 'poll-job');
        formData.set('jobId', id);
        pollSubmitRef.current(formData, { method: 'POST' });
      };
      pollIntervalRef.current = setInterval(submitPoll, 1000);
    },
    [stopPolling],
  );

  useEffect(() => {
    if (jobId) startPolling(jobId);
    return stopPolling;
  }, [jobId, startPolling, stopPolling]);

  const handleDispatch = () => {
    setDispatching(true);
    setJobId(null);
    setJobState(null);
    const formData = new FormData();
    formData.set('intent', 'dispatch-loopback');
    dispatchFetcher.submit(formData, { method: 'POST' });
  };

  const isTerminal = jobState?.status === 'COMPLETED' || jobState?.status === 'FAILED';

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <ui.Button onClick={handleDispatch} disabled={dispatching || (!!jobId && !isTerminal)}>
          <Zap className="w-4 h-4 mr-1.5" />
          {dispatching ? 'Enqueueing…' : 'Enqueue Loopback Job'}
        </ui.Button>
        {dispatchFetcher.data && !dispatchFetcher.data.ok && (
          <span className="text-sm text-red-600">{dispatchFetcher.data.error}</span>
        )}
      </div>

      {jobId && jobState && (
        <div className="p-4 space-y-3 bg-white rounded-lg border">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="font-mono text-xs text-gray-500">{jobId}</div>
              <StatusBadge status={jobState.status} />
            </div>
            {!isTerminal && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
          </div>

          {jobState.messages.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                Messages
              </div>
              <div className="space-y-0.5">
                {jobState.messages.map((msg, i) => (
                  <div
                    key={i}
                    className="pl-3 font-mono text-sm text-gray-700 border-l-2 border-gray-200"
                  >
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {jobState.results && (
            <div className="space-y-1">
              <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                Results
              </div>
              <pre className="overflow-x-auto p-2 text-xs bg-gray-50 rounded">
                {JSON.stringify(jobState.results, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Queue info ────────────────────────────────────────────────────

function QueueInfoPanel({
  queue,
}: {
  queue: {
    consumerRoute: string;
    queueName: string;
  };
}) {
  return (
    <section className="overflow-hidden bg-white rounded-lg border">
      <div className="flex gap-2 items-center px-4 py-3 bg-gray-50 border-b">
        <Radio className="w-4 h-4 text-gray-600" />
        <h2 className="text-lg font-semibold">Queue</h2>
      </div>
      <div className="p-4 space-y-4 text-sm">
        <p className="text-gray-600">
          Internal jobs call{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">enqueueAndDispatchJob()</code>,
          which inserts a QUEUED row and publishes to the pgmq{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{queue.queueName}</code> queue.
          A pg_net trigger on each enqueue wakes the consumer at{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{queue.consumerRoute}</code>;
          the builtin{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">job-queue-drain</code> cron job
          (via cron tick) is the backup if a wake is missed. The handler runs via{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">processJobMessage</code>.
        </p>

        <dl className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-x-4">
          <dt className="font-medium text-gray-500">pgmq queue</dt>
          <dd className="font-mono text-gray-900">{queue.queueName}</dd>

          <dt className="font-medium text-gray-500">Consumer</dt>
          <dd className="font-mono text-gray-900">{queue.consumerRoute}</dd>
        </dl>
      </div>
    </section>
  );
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

function PauseStatus({ paused }: { paused: boolean }) {
  if (paused) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">
        <AlertTriangle className="w-3.5 h-3.5" /> Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
      <CheckCircle className="w-3.5 h-3.5" /> Draining
    </span>
  );
}

function DrainConfigPanel({ status }: { status: JobQueueDrainStatus }) {
  const urlFetcher = useFetcher<{ ok: boolean; intent?: string; error?: string }>();
  const secretFetcher = useFetcher<{ ok: boolean; intent?: string; error?: string }>();
  const pauseFetcher = useFetcher<{ ok: boolean; intent?: string; error?: string }>();
  const [url, setUrl] = useState(status.drainUrl ?? status.defaultDrainUrl);

  const urlBusy = urlFetcher.state !== 'idle';
  const secretBusy = secretFetcher.state !== 'idle';
  const pauseBusy = pauseFetcher.state !== 'idle';

  return (
    <section className="overflow-hidden bg-white rounded-lg border">
      <div className="flex gap-2 items-center px-4 py-3 bg-gray-50 border-b">
        <KeyRound className="w-4 h-4 text-gray-600" />
        <h2 className="text-lg font-semibold">Drain config</h2>
      </div>
      <div className="p-4 space-y-5 text-sm">
        <p className="text-gray-600">
          The <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">_JobQueueDrainConfig</code>{' '}
          row is read by the pg_net enqueue trigger inside Postgres — it supplies the push-to-drain
          URL and bearer secret for wakes fired on insert. Populate it so jobs drain promptly;
          backup draining is handled by the{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">job-queue-drain</code> cron job
          (System → Cron). In local dev the URL should use{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">host.docker.internal</code> so
          Postgres in Docker can reach the dev server on the host.
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

        <div className="space-y-2 pt-2 border-t">
          <div className="flex gap-2 items-center">
            <span className="font-medium text-gray-500">Queue drain</span>
            <PauseStatus paused={status.paused} />
          </div>
          <p className="text-xs text-gray-500">
            Pausing leaves jobs and pgmq messages queued but makes automatic wakes, cron drain, and
            manual drain no-op. Resuming sends one normal drain wake to start clearing backlog.
          </p>
          <pauseFetcher.Form method="post">
            <input
              type="hidden"
              name="intent"
              value={status.paused ? 'resume-drain' : 'pause-drain'}
            />
            <ui.Button
              type="submit"
              variant={status.paused ? 'default' : 'outline'}
              disabled={pauseBusy}
            >
              {pauseBusy ? 'Updating…' : status.paused ? 'Resume queue' : 'Pause queue'}
            </ui.Button>
          </pauseFetcher.Form>
          {pauseFetcher.data && !pauseFetcher.data.ok && (
            <p className="text-xs text-red-600">{pauseFetcher.data.error}</p>
          )}
          {pauseFetcher.data?.ok && pauseFetcher.data.intent === 'pause-drain' && (
            <p className="text-xs text-yellow-700">Queue drain paused.</p>
          )}
          {pauseFetcher.data?.ok && pauseFetcher.data.intent === 'resume-drain' && (
            <p className="text-xs text-green-700">Queue drain resumed and wake requested.</p>
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

type TimestampValue = string | Date | null;

function formatTimestamp(value: TimestampValue): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function QueueTailPanel({ tail }: { tail: JobQueueTail }) {
  const revalidator = useRevalidator();
  const refreshing = revalidator.state !== 'idle';
  const drainFetcher = useFetcher<{
    ok: boolean;
    processed?: number;
    capped?: boolean;
    paused?: boolean;
    error?: string;
  }>();
  const draining = drainFetcher.state !== 'idle';

  return (
    <section className="overflow-hidden bg-white rounded-lg border">
      <div className="flex gap-2 justify-between items-center px-4 py-3 bg-gray-50 border-b">
        <div className="flex gap-2 items-center">
          <Radio className="w-4 h-4 text-gray-600" />
          <h2 className="text-lg font-semibold">Queue tail</h2>
          <span className="font-mono text-xs text-gray-500">
            pgmq{tail.depth != null ? ` · depth ${tail.depth}` : ''}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <drainFetcher.Form method="post">
            <input type="hidden" name="intent" value="drain-now" />
            <ui.Button type="submit" variant="outline" disabled={draining}>
              <PlayCircle className={`w-4 h-4 mr-1.5 ${draining ? 'animate-pulse' : ''}`} />
              {draining ? 'Draining…' : 'Drain now'}
            </ui.Button>
          </drainFetcher.Form>
          <ui.Button variant="ghost" onClick={() => revalidator.revalidate()} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </ui.Button>
        </div>
      </div>

      {drainFetcher.data &&
        (drainFetcher.data.ok ? (
          <div className="px-4 py-2 text-xs text-green-700 bg-green-50 border-b">
            {drainFetcher.data.paused ? (
              <>Queue drain is paused; no messages were processed.</>
            ) : (
              <>
                Drained {drainFetcher.data.processed} message
                {drainFetcher.data.processed === 1 ? '' : 's'} in-process.
                {drainFetcher.data.capped
                  ? ' Stopped at the batch limit — click “Drain now” again to continue.'
                  : ''}
              </>
            )}
          </div>
        ) : (
          <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b">
            Drain failed after {drainFetcher.data.processed ?? 0}:{' '}
            <span className="font-mono">{drainFetcher.data.error}</span>
          </div>
        ))}

      <div className="p-4 text-sm">
        {tail.error && (
          <p className="text-red-600">
            Could not read the queue: <span className="font-mono text-xs">{tail.error}</span>
          </p>
        )}
        {!tail.error && tail.entries.length === 0 && (
          <p className="text-gray-500">Queue is empty — no pending or in-flight messages.</p>
        )}
        {!tail.error && tail.entries.length > 0 && (
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

// ─── Recent jobs ─────────────────────────────────────────────────────

type RecentJob = {
  id: string;
  job_type: string;
  status: string;
  date_created: string | Date;
  date_modified: string | Date;
  scheduled_at: string | null;
};

function isStaleQueuedJob(job: RecentJob): boolean {
  if (job.status !== 'QUEUED') return false;
  if (job.job_type === KnownJobTypes.CLI_CHECK) return false;
  const modifiedAt = new Date(job.date_modified).getTime();
  return !Number.isNaN(modifiedAt) && Date.now() - modifiedAt >= STALE_QUEUED_JOB_REPAIR_MS;
}

function RedispatchQueuedJobButton({ job }: { job: RecentJob }) {
  const fetcher = useFetcher<{
    ok: boolean;
    intent?: string;
    job_id?: string;
    messageId?: number;
    error?: string;
  }>();
  const revalidator = useRevalidator();
  const busy = fetcher.state !== 'idle';
  const repairable = isStaleQueuedJob(job);

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.intent === 'redispatch-queued-job') {
      revalidator.revalidate();
    }
  }, [fetcher.data, revalidator]);

  if (job.status !== 'QUEUED') {
    return <span className="text-xs text-gray-400">—</span>;
  }

  if (job.job_type === KnownJobTypes.CLI_CHECK) {
    return <span className="text-xs text-gray-500">Externally tracked</span>;
  }

  return (
    <div className="space-y-1">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="redispatch-queued-job" />
        <input type="hidden" name="jobId" value={job.id} />
        <ui.Button type="submit" variant="outline" size="sm" disabled={busy || !repairable}>
          <PlayCircle className={`w-3.5 h-3.5 mr-1 ${busy ? 'animate-pulse' : ''}`} />
          {busy ? 'Redispatching…' : 'Redispatch'}
        </ui.Button>
      </fetcher.Form>
      {!repairable && <p className="text-xs text-gray-500">Available after 2 min queued.</p>}
      {fetcher.data?.ok && fetcher.data.intent === 'redispatch-queued-job' && (
        <p className="text-xs text-green-700">Redispatched as message {fetcher.data.messageId}.</p>
      )}
      {fetcher.data && !fetcher.data.ok && (
        <p className="text-xs text-red-700">{fetcher.data.error}</p>
      )}
    </div>
  );
}

function RecentJobsPanel({ jobs, limit }: { jobs: RecentJob[]; limit: number }) {
  const revalidator = useRevalidator();
  const refreshing = revalidator.state !== 'idle';

  return (
    <section className="overflow-hidden bg-white rounded-lg border">
      <div className="flex gap-2 justify-between items-center px-4 py-3 bg-gray-50 border-b">
        <div className="flex gap-2 items-center">
          <Clock className="w-4 h-4 text-gray-600" />
          <h2 className="text-lg font-semibold">Recent jobs</h2>
          <span className="font-mono text-xs text-gray-500">latest up to {limit}</span>
        </div>
        <ui.Button variant="ghost" onClick={() => revalidator.revalidate()} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </ui.Button>
      </div>

      <div className="p-4 text-sm">
        {jobs.length === 0 ? (
          <p className="text-gray-500">No jobs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Job id
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Created
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Scheduled
                  </th>
                  <th className="px-3 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Repair
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{job.id}</td>
                    <td className="px-3 py-2 font-mono text-sm">{job.job_type}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimestamp(job.date_created)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimestamp(job.scheduled_at)}
                    </td>
                    <td className="px-3 py-2">
                      <RedispatchQueuedJobButton job={job} />
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

export default function SystemJobsPage({ loaderData }: Route.ComponentProps) {
  const { jobTypes, queue, drainStatus, tail, recentJobs } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'queues' ? 'queues' : 'jobs';

  const handleTabChange = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'jobs') {
          next.delete('tab');
        } else {
          next.set('tab', value);
        }
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  return (
    <PageFrame
      title="Jobs"
      description="View registered job types, test dispatch, and configure and monitor the queue."
    >
      <ui.Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-2">
        <ui.TabsList>
          <ui.TabsTrigger value="jobs">Jobs</ui.TabsTrigger>
          <ui.TabsTrigger value="queues">Queues</ui.TabsTrigger>
        </ui.TabsList>

        <ui.TabsContent value="jobs" className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Registered Job Types</h2>
            <div className="overflow-hidden rounded-lg border">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Job Type
                    </th>
                    <th className="px-4 py-2 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobTypes.map((jt: string) => {
                    const isCore = Object.values(KnownJobTypes).includes(jt as any);
                    return (
                      <tr key={jt}>
                        <td className="px-4 py-2 font-mono text-sm">{jt}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {isCore ? 'core' : 'extension'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-1 text-lg font-semibold">Loopback Test</h2>
            <p className="mb-3 text-sm text-gray-500">
              Enqueues a LOOPBACK job via the queue. The handler simulates ~8 seconds of async work,
              posting status updates along the way. Use this to verify enqueue, queue delivery, and
              job lifecycle.
            </p>
            <LoopbackTest />
          </section>

          <RecentJobsPanel jobs={recentJobs} limit={RECENT_JOBS_LIMIT} />
        </ui.TabsContent>

        <ui.TabsContent value="queues" className="space-y-8">
          <QueueInfoPanel queue={queue} />

          {drainStatus.ok ? (
            <DrainConfigPanel status={drainStatus.status} />
          ) : (
            <section className="p-4 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
              Could not read drain config:{' '}
              <span className="font-mono text-xs">{drainStatus.error}</span>
            </section>
          )}

          <QueueTailPanel tail={tail} />
        </ui.TabsContent>
      </ui.Tabs>
    </PageFrame>
  );
}
