import type { Route } from './+types/route';
import { data, useFetcher } from 'react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  withAppAdminContext,
  jobs,
  registerExtensionJobs,
  getPrismaClient,
  getConfig,
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
  ArrowRight,
} from 'lucide-react';
import { extensions as serverExtensions } from '../../../extensions/server';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Jobs - System Admin' },
    { name: 'description', content: 'Job dispatch testing and monitoring' },
  ];
};

type DispatchRoutingMode = 'test' | 'emulator' | 'dev_http_stub' | 'production';

function getDispatchRoutingMode(): DispatchRoutingMode {
  if (process.env.NODE_ENV === 'test' || process.env.APP_CONFIG_ENV === 'test') return 'test';
  if (process.env.PUBSUB_EMULATOR_HOST) return 'emulator';
  if (process.env.NODE_ENV === 'development') return 'dev_http_stub';
  return 'production';
}

function resolveDispatchTopicDisplay(
  rawTopic: string | undefined,
  fallbackProjectId: string,
): {
  topicId: string;
  fullResourceName: string;
  projectId: string;
  configuredInAppConfig: boolean;
} {
  const configuredInAppConfig = rawTopic != null && rawTopic.length > 0;
  const topicNameOrId = rawTopic?.length ? rawTopic : 'scmsJobDispatch';
  const fullPath = /^projects\/[^/]+\/topics\/.+$/;
  if (fullPath.test(topicNameOrId)) {
    const m = topicNameOrId.match(/^projects\/([^/]+)\/topics\/(.+)$/);
    if (m) {
      return {
        topicId: m[2],
        fullResourceName: topicNameOrId,
        projectId: m[1],
        configuredInAppConfig,
      };
    }
  }
  const projectId = fallbackProjectId || 'curvenote-dev-1';
  return {
    topicId: topicNameOrId,
    fullResourceName: `projects/${projectId}/topics/${topicNameOrId}`,
    projectId,
    configuredInAppConfig,
  };
}

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args);

  const config = await getConfig();
  const api = config.api as {
    pubsubProjectId?: string;
    dispatchTopic?: string;
    dispatchSASecretKeyfile?: string;
  };
  const pubsubProjectId = api.pubsubProjectId ?? 'curvenote-dev-1';
  const topicInfo = resolveDispatchTopicDisplay(api.dispatchTopic, pubsubProjectId);
  const routingMode = getDispatchRoutingMode();
  const port = process.env.PORT ?? '3031';
  const devLocalDispatchUrl = `http://127.0.0.1:${port}/v1/jobs/dispatch`;
  const hasDispatchCredentials =
    typeof api.dispatchSASecretKeyfile === 'string' && api.dispatchSASecretKeyfile.length > 0;

  // Registered job types
  const coreJobTypes = Object.values(KnownJobTypes);
  const extensionJobTypes = registerExtensionJobs(serverExtensions).map((j) => j.jobType);
  const allJobTypes = [...coreJobTypes, ...extensionJobTypes];

  return {
    jobTypes: allJobTypes,
    dispatch: {
      topicId: topicInfo.topicId,
      fullTopicResourceName: topicInfo.fullResourceName,
      pubsubProjectId: topicInfo.projectId,
      dispatchTopicSetInConfig: topicInfo.configuredInAppConfig,
      routingMode,
      pubsubEmulatorHost: process.env.PUBSUB_EMULATOR_HOST ?? null,
      devLocalDispatchUrl,
      hasDispatchCredentials,
    },
  };
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withAppAdminContext(args);
  const formData = await args.request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'dispatch-loopback') {
    try {
      const params = jobs.dispatchLoopbackJob({ invoked_by_id: ctx.user?.id });
      const result = await jobs.dispatchAJob(params);
      return data({ ok: true, job_id: result.job_id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dispatch failed';
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

  // Handle dispatch response
  useEffect(() => {
    if (dispatchFetcher.data?.ok && dispatchFetcher.data.job_id) {
      setJobId(dispatchFetcher.data.job_id);
      setDispatching(false);
      setJobState({ status: 'DISPATCHED', messages: [], results: null });
    } else if (dispatchFetcher.data && !dispatchFetcher.data.ok) {
      setDispatching(false);
    }
  }, [dispatchFetcher.data]);

  // Handle poll response
  useEffect(() => {
    if (pollFetcher.data?.ok && pollFetcher.data.job) {
      const job = pollFetcher.data.job;
      setJobState({
        status: job.status,
        messages: job.messages as string[],
        results: job.results as Record<string, unknown> | null,
      });
      // Stop polling when terminal
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        stopPolling();
      }
    }
  }, [pollFetcher.data, stopPolling]);

  // Start polling when we have a job ID
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
          {dispatching ? 'Dispatching…' : 'Dispatch Loopback Job'}
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

          {/* Messages timeline */}
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

          {/* Results */}
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

// ─── Dispatch info ───────────────────────────────────────────────────

function routingModeCopy(mode: DispatchRoutingMode): { label: string; detail: string } {
  switch (mode) {
    case 'test':
      return {
        label: 'Test',
        detail:
          'No Pub/Sub traffic — dispatch returns a fake id. Use integration tests with NODE_ENV=test.',
      };
    case 'emulator':
      return {
        label: 'Pub/Sub emulator',
        detail:
          'The client publishes to the topic below. The emulator pushes to your app (same shape as production).',
      };
    case 'dev_http_stub':
      return {
        label: 'Development HTTP stub',
        detail:
          'No Pub/Sub publish: the server POSTs a Pub/Sub-shaped envelope straight to the local dispatch URL. The topic name is still the logical target for production.',
      };
    case 'production':
      return {
        label: 'Production GCP Pub/Sub',
        detail:
          'Messages publish to the topic below. Your push subscription delivers to /v1/jobs/dispatch on the deployed app.',
      };
  }
}

function DispatchInfoPanel({
  dispatch,
}: {
  dispatch: {
    topicId: string;
    fullTopicResourceName: string;
    pubsubProjectId: string;
    dispatchTopicSetInConfig: boolean;
    routingMode: DispatchRoutingMode;
    pubsubEmulatorHost: string | null;
    devLocalDispatchUrl: string;
    hasDispatchCredentials: boolean;
  };
}) {
  const routing = routingModeCopy(dispatch.routingMode);
  const productionNeedsCreds =
    dispatch.routingMode === 'production' && !dispatch.hasDispatchCredentials;

  return (
    <section className="overflow-hidden bg-white rounded-lg border">
      <div className="flex gap-2 items-center px-4 py-3 bg-gray-50 border-b">
        <Radio className="w-4 h-4 text-gray-600" />
        <h2 className="text-lg font-semibold">Dispatch topic and return path</h2>
      </div>
      <div className="p-4 space-y-4 text-sm">
        <p className="text-gray-600">
          Internal jobs call{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">dispatchAJob()</code>, which
          targets the centralized dispatch topic. The app receives work at{' '}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">POST /v1/jobs/dispatch</code>,
          creates the job row, then runs the handler.
        </p>

        <dl className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-x-4">
          <dt className="font-medium text-gray-500">Registered topic name</dt>
          <dd className="font-mono text-gray-900 break-all">{dispatch.topicId}</dd>

          <dt className="font-medium text-gray-500">Full Pub/Sub resource</dt>
          <dd className="font-mono text-xs text-gray-800 break-all">
            {dispatch.fullTopicResourceName}
          </dd>

          <dt className="font-medium text-gray-500">Pub/Sub project</dt>
          <dd className="font-mono text-gray-900 break-all">{dispatch.pubsubProjectId}</dd>

          <dt className="font-medium text-gray-500">App config</dt>
          <dd className="text-gray-600">
            {dispatch.dispatchTopicSetInConfig ? (
              <>
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">dispatchTopic</code> is
                set in app config.
              </>
            ) : (
              <>
                Using default topic id{' '}
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">scmsJobDispatch</code> (
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">dispatchTopic</code>{' '}
                unset).
              </>
            )}
          </dd>

          <dt className="font-medium text-gray-500">Current routing</dt>
          <dd>
            <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
              {routing.label}
            </span>
            <p className="mt-1 text-gray-600">{routing.detail}</p>
            {dispatch.pubsubEmulatorHost && (
              <p className="mt-1 font-mono text-xs text-gray-700">
                PUBSUB_EMULATOR_HOST={dispatch.pubsubEmulatorHost}
              </p>
            )}
            {dispatch.routingMode === 'dev_http_stub' && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-700">
                <span className="inline-flex gap-1 items-center px-2 py-1 text-amber-900 bg-amber-50 rounded border">
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  Stub POST
                </span>
                <span className="font-mono break-all">{dispatch.devLocalDispatchUrl}</span>
              </p>
            )}
          </dd>
        </dl>

        {productionNeedsCreds && (
          <p className="px-3 py-2 text-sm text-amber-800 bg-amber-50 rounded-md border border-amber-200">
            Production routing expects <code className="text-xs">dispatchSASecretKeyfile</code> in
            app config for publishing to the topic.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function SystemJobsPage({ loaderData }: Route.ComponentProps) {
  const { jobTypes, dispatch } = loaderData;

  return (
    <PageFrame
      title="Jobs"
      description="View registered job types and test the dispatch mechanism."
    >
      <div className="space-y-8">
        {/* Registered job types */}
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

        <DispatchInfoPanel dispatch={dispatch} />

        {/* Dispatch test */}
        <section>
          <h2 className="mb-1 text-lg font-semibold">Dispatch Test</h2>
          <p className="mb-3 text-sm text-gray-500">
            Dispatches a LOOPBACK job via Pub/Sub. The handler simulates ~8 seconds of async work,
            posting status updates along the way. Use this to verify the dispatch endpoint, Pub/Sub
            delivery, and job lifecycle.
          </p>
          <LoopbackTest />
        </section>
      </div>
    </PageFrame>
  );
}
