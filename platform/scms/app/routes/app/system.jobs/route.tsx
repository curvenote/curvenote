import type { Route } from './+types/route';
import { data, useFetcher } from 'react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  withAppAdminContext,
  jobs,
  registerExtensionJobs,
  getPrismaClient,
} from '@curvenote/scms-server';
import { PageFrame, ui, KnownJobTypes } from '@curvenote/scms-core';
import { Zap, RefreshCw, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { extensions as serverExtensions } from '../../../extensions/server';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Jobs - System Admin' },
    { name: 'description', content: 'Job dispatch testing and monitoring' },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args);

  // Registered job types
  const coreJobTypes = Object.values(KnownJobTypes);
  const extensionJobTypes = registerExtensionJobs(serverExtensions).map((j) => j.jobType);
  const allJobTypes = [...coreJobTypes, ...extensionJobTypes];

  return { jobTypes: allJobTypes };
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
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    }
  }, [pollFetcher.data]);

  // Start polling when we have a job ID
  const startPolling = useCallback(
    (id: string) => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(() => {
        const formData = new FormData();
        formData.set('intent', 'poll-job');
        formData.set('jobId', id);
        pollFetcher.submit(formData, { method: 'POST' });
      }, 1000);
    },
    [pollFetcher],
  );

  useEffect(() => {
    if (jobId) startPolling(jobId);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId, startPolling]);

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
      <div className="flex items-center gap-3">
        <ui.Button onClick={handleDispatch} disabled={dispatching || (!!jobId && !isTerminal)}>
          <Zap className="w-4 h-4 mr-1.5" />
          {dispatching ? 'Dispatching…' : 'Dispatch Loopback Job'}
        </ui.Button>
        {dispatchFetcher.data && !dispatchFetcher.data.ok && (
          <span className="text-sm text-red-600">{dispatchFetcher.data.error}</span>
        )}
      </div>

      {jobId && jobState && (
        <div className="border rounded-lg p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-mono text-gray-500">{jobId}</div>
              <StatusBadge status={jobState.status} />
            </div>
            {!isTerminal && (
              <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>

          {/* Messages timeline */}
          {jobState.messages.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Messages
              </div>
              <div className="space-y-0.5">
                {jobState.messages.map((msg, i) => (
                  <div key={i} className="text-sm text-gray-700 font-mono pl-3 border-l-2 border-gray-200">
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {jobState.results && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Results
              </div>
              <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto">
                {JSON.stringify(jobState.results, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function SystemJobsPage({ loaderData }: Route.ComponentProps) {
  const { jobTypes } = loaderData;

  return (
    <PageFrame
      title="Jobs"
      description="View registered job types and test the dispatch mechanism."
    >
      <div className="space-y-8">
        {/* Registered job types */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Registered Job Types</h2>
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobTypes.map((jt: string) => {
                  const isCore = Object.values(KnownJobTypes).includes(jt as any);
                  return (
                    <tr key={jt}>
                      <td className="px-4 py-2 text-sm font-mono">{jt}</td>
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

        {/* Dispatch test */}
        <section>
          <h2 className="text-lg font-semibold mb-1">Dispatch Test</h2>
          <p className="text-sm text-gray-500 mb-3">
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
