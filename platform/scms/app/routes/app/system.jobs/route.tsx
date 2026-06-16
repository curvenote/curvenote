import type { Route } from './+types/route';
import { data, useFetcher } from 'react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  withAppAdminContext,
  registerExtensionJobs,
  getPrismaClient,
  enqueueAndDispatchJob,
  resolveQueueProviderName,
} from '@curvenote/scms-server';
import { PageFrame, ui, KnownJobTypes } from '@curvenote/scms-core';
import { Zap, RefreshCw, CheckCircle, XCircle, Clock, Loader2, Radio } from 'lucide-react';
import { extensions as serverExtensions } from '../../../extensions/server';
import { uuidv7 } from 'uuidv7';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Jobs - System Admin' },
    { name: 'description', content: 'Job queue testing and monitoring' },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args);

  const coreJobTypes = Object.values(KnownJobTypes);
  const extensionJobTypes = registerExtensionJobs(serverExtensions).map((j) => j.jobType);
  const allJobTypes = [...coreJobTypes, ...extensionJobTypes];
  const queueProvider = resolveQueueProviderName();

  return {
    jobTypes: allJobTypes,
    queue: {
      provider: queueProvider,
      consumerRoute:
        queueProvider === 'mock'
          ? '/v1/jobs/mock-push'
          : 'api/v1/jobs/vercel-push.ts (Vercel Queue trigger)',
      topicName: 'job',
      queuesProviderEnv: process.env.QUEUES_PROVIDER ?? null,
    },
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
      date_created: string;
      date_modified: string;
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

function queueProviderCopy(provider: string): { label: string; detail: string } {
  switch (provider) {
    case 'mock':
      return {
        label: 'Mock (in-process)',
        detail:
          'Jobs are delivered in-process via processJobMessage — no external queue. Used in development and tests.',
      };
    case 'vercel':
      return {
        label: 'Vercel Queues',
        detail:
          'Jobs publish to the Vercel Queue topic and are consumed by api/v1/jobs/vercel-push.ts (queue trigger).',
      };
    default:
      return { label: provider, detail: 'Unknown queue provider.' };
  }
}

function QueueInfoPanel({
  queue,
}: {
  queue: {
    provider: string;
    consumerRoute: string;
    topicName: string;
    queuesProviderEnv: string | null;
  };
}) {
  const routing = queueProviderCopy(queue.provider);

  return (
    <section className="overflow-hidden bg-white rounded-lg border">
      <div className="flex gap-2 items-center px-4 py-3 bg-gray-50 border-b">
        <Radio className="w-4 h-4 text-gray-600" />
        <h2 className="text-lg font-semibold">Queue provider</h2>
      </div>
      <div className="p-4 space-y-4 text-sm">
        <p className="text-gray-600">
          Internal jobs call{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">enqueueAndDispatchJob()</code>,
          which inserts a QUEUED row and publishes to the configured queue. The consumer at{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{queue.consumerRoute}</code>{' '}
          runs the handler via{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">processJobMessage</code>.
        </p>

        <dl className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-x-4">
          <dt className="font-medium text-gray-500">Queue topic</dt>
          <dd className="font-mono text-gray-900">{queue.topicName}</dd>

          <dt className="font-medium text-gray-500">Active provider</dt>
          <dd>
            <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
              {routing.label}
            </span>
            <p className="mt-1 text-gray-600">{routing.detail}</p>
            {queue.queuesProviderEnv && (
              <p className="mt-1 font-mono text-xs text-gray-700">
                QUEUES_PROVIDER={queue.queuesProviderEnv}
              </p>
            )}
          </dd>
        </dl>
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function SystemJobsPage({ loaderData }: Route.ComponentProps) {
  const { jobTypes, queue } = loaderData;

  return (
    <PageFrame
      title="Jobs"
      description="View registered job types and test the queue dispatch mechanism."
    >
      <div className="space-y-8">
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

        <QueueInfoPanel queue={queue} />

        <section>
          <h2 className="mb-1 text-lg font-semibold">Loopback Test</h2>
          <p className="mb-3 text-sm text-gray-500">
            Enqueues a LOOPBACK job via the queue. The handler simulates ~8 seconds of async work,
            posting status updates along the way. Use this to verify enqueue, queue delivery, and
            job lifecycle.
          </p>
          <LoopbackTest />
        </section>
      </div>
    </PageFrame>
  );
}
