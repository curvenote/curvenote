import { formatDatetime, ui } from '@curvenote/scms-core';
import { CronJobTargetType } from '@curvenote/scms-server';
import { useFetcher } from 'react-router';
import type { CronJobListRow } from './types';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-1 min-w-0">
      <span className="flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}:
      </span>
      <span className="min-w-0 text-sm text-gray-600 break-all dark:text-gray-400">{children}</span>
    </div>
  );
}

function LastRunSummary({ job }: { job: CronJobListRow }) {
  if (!job.last_run_at && !job.last_status) {
    return <span className="text-xs text-gray-500">—</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {job.last_run_at ? (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {formatDatetime(job.last_run_at)}
        </span>
      ) : null}
      {job.last_status ? (
        <ui.Badge variant={job.last_status === 'SUCCESS' ? 'default' : 'destructive'}>
          {job.last_status}
        </ui.Badge>
      ) : null}
      {job.last_error ? (
        <span className="text-xs text-red-600 dark:text-red-400" title={job.last_error}>
          {job.last_error}
        </span>
      ) : null}
    </span>
  );
}

export function CronJobListItem({ job }: { job: CronJobListRow }) {
  const runFetcher = useFetcher();
  const toggleFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  const isRunning = runFetcher.state === 'submitting' && runFetcher.formData?.get('id') === job.id;
  const isToggling =
    toggleFetcher.state === 'submitting' && toggleFetcher.formData?.get('id') === job.id;
  const isDeleting =
    deleteFetcher.state === 'submitting' && deleteFetcher.formData?.get('id') === job.id;

  return (
    <div className="flex flex-col w-full gap-3 lg:flex-row lg:gap-6">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-medium text-gray-900 truncate dark:text-gray-100">
            {job.name}
          </h3>
          <div className="flex flex-wrap gap-1">
            {job.enabled ? (
              <ui.Badge variant="default">Enabled</ui.Badge>
            ) : (
              <ui.Badge variant="outline">Disabled</ui.Badge>
            )}
            {job.running_since ? <ui.Badge variant="warning">Running</ui.Badge> : null}
          </div>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2">
          <DetailRow label="Schedule">
            <span className="font-mono text-xs">{job.schedule}</span>
            {job.timezone && job.timezone !== 'UTC' ? (
              <span className="ml-1 text-xs text-gray-500">({job.timezone})</span>
            ) : null}
          </DetailRow>
          <DetailRow label="Next run">
            {job.next_run_at ? (
              <span className="text-xs">{formatDatetime(job.next_run_at)}</span>
            ) : (
              <span className="text-xs text-gray-500">—</span>
            )}
          </DetailRow>
          <DetailRow label="Last run">
            <LastRunSummary job={job} />
          </DetailRow>
          <DetailRow label="Target type">{job.target_type}</DetailRow>
          {job.target_type === CronJobTargetType.HTTP ? (
            <>
              <DetailRow label="Target URL">
                {job.resolvedTargetUrl ?? job.target_url ?? (
                  <span className="text-xs text-gray-500">—</span>
                )}
              </DetailRow>
              <DetailRow label="Scope">
                {job.target_scope ?? <span className="text-xs text-gray-500">—</span>}
              </DetailRow>
            </>
          ) : (
            <DetailRow label="Job type">
              {job.job_type ?? <span className="text-xs text-gray-500">—</span>}
            </DetailRow>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 lg:flex-shrink-0 lg:w-32">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Actions:</span>
        <runFetcher.Form method="post">
          <input type="hidden" name="intent" value="run-now" />
          <input type="hidden" name="id" value={job.id} />
          <ui.Button
            type="submit"
            variant="outline"
            size="xs"
            disabled={isRunning}
            className="text-xs"
          >
            {isRunning ? 'Running…' : 'Run now'}
          </ui.Button>
        </runFetcher.Form>
        <toggleFetcher.Form method="post">
          <input type="hidden" name="intent" value="toggle" />
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="enabled" value={String(!job.enabled)} />
          <ui.Button
            type="submit"
            variant="outline"
            size="xs"
            disabled={isToggling}
            className="text-xs"
          >
            {isToggling ? 'Saving…' : job.enabled ? 'Disable' : 'Enable'}
          </ui.Button>
        </toggleFetcher.Form>
        <deleteFetcher.Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={job.id} />
          <ui.Button
            type="submit"
            variant="outline"
            size="xs"
            disabled={isDeleting}
            className="text-xs"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </ui.Button>
        </deleteFetcher.Form>
      </div>
    </div>
  );
}
