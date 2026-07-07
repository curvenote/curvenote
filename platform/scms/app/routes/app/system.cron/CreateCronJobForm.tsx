import { useEffect, useMemo, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Plus, PlusCircle } from 'lucide-react';
import { cn, cronEndpointScope, primitives, ui, useExpandableForm } from '@curvenote/scms-core';
import { CRON_HTTP_METHODS, type CronHttpMethod } from './constants';
import { previewCronSchedule } from './previewCronSchedule';

type CreateActionData = {
  success?: boolean;
  message?: string;
  error?: { message: string };
};

export function CreateCronJobForm() {
  const fetcher = useFetcher<CreateActionData>();
  const prevFetcherState = useRef(fetcher.state);

  const { isExpanded, isExiting, expand, handleCancel, formRef, onSubmit } = useExpandableForm(
    fetcher,
    { animationDuration: 200 },
  );

  const isSubmitting = fetcher.state === 'submitting';
  const [httpMethod, setHttpMethod] = useState<CronHttpMethod>('POST');
  const [schedule, setSchedule] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [targetScope, setTargetScope] = useState('');
  const [isScopeManuallyEdited, setIsScopeManuallyEdited] = useState(false);
  const schedulePreview = useMemo(() => previewCronSchedule(schedule), [schedule]);

  useEffect(() => {
    if (!isExpanded) {
      setHttpMethod('POST');
      setSchedule('');
      setTargetPath('');
      setTargetScope('');
      setIsScopeManuallyEdited(false);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isScopeManuallyEdited) {
      setTargetScope(targetPath.trim() ? cronEndpointScope(httpMethod, targetPath) : '');
    }
  }, [httpMethod, targetPath, isScopeManuallyEdited]);

  useEffect(() => {
    const wasBusy = prevFetcherState.current !== 'idle';
    prevFetcherState.current = fetcher.state;

    if (!wasBusy || fetcher.state !== 'idle' || !fetcher.data) {
      return;
    }

    if (fetcher.data.error) {
      ui.toastError(fetcher.data.error.message);
    } else if (fetcher.data.success) {
      ui.toastSuccess(fetcher.data.message ?? 'Cron job created successfully');
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="space-y-0">
      {!isExpanded && (
        <div className="flex justify-end">
          <ui.Button onClick={expand} variant="default" disabled={isSubmitting}>
            <PlusCircle className="mr-2 w-4 h-4" />
            Add Cron Job
          </ui.Button>
        </div>
      )}

      {isExpanded && (
        <primitives.Card className="p-6 bg-white dark:bg-white">
          <fetcher.Form
            ref={formRef}
            onSubmit={onSubmit}
            method="post"
            className={cn('space-y-4', isExiting && 'animate-out fade-out duration-200')}
          >
            <input type="hidden" name="intent" value="create" />

            <div className="space-y-1">
              <div className="text-lg font-semibold">Add Cron Job</div>
              <p className="text-sm text-muted-foreground">
                Cron jobs are internal only and secured by scoped handshake tokens
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <ui.Label htmlFor="cron-name">Name *</ui.Label>
                <ui.Input
                  id="cron-name"
                  name="name"
                  placeholder="My New Cron"
                  required
                  autoFocus
                  disabled={isSubmitting}
                  className="mt-1"
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Unique name shown in the cron job list
                </p>
              </div>

              <div>
                <ui.Label htmlFor="cron-description">Description</ui.Label>
                <ui.Input
                  id="cron-description"
                  name="description"
                  placeholder="Runs the nightly sweep for stale jobs"
                  disabled={isSubmitting}
                  className="mt-1"
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Optional details shown below the name in the list
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <ui.Label htmlFor="cron-schedule">Schedule *</ui.Label>
                <ui.Input
                  id="cron-schedule"
                  name="schedule"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="* * * * *"
                  required
                  disabled={isSubmitting}
                  className="mt-1 font-mono"
                />
                {schedulePreview?.valid === false ? (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {schedulePreview.error}
                  </p>
                ) : schedulePreview?.valid === true ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {schedulePreview.description}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Standard cron expression (UTC)
                  </p>
                )}
              </div>

              <div>
                <ui.Label htmlFor="cron-http-method">HTTP method</ui.Label>
                <input type="hidden" name="http_method" value={httpMethod} />
                <ui.Select
                  value={httpMethod}
                  onValueChange={(value) => setHttpMethod(value as CronHttpMethod)}
                  disabled={isSubmitting}
                >
                  <ui.SelectTrigger id="cron-http-method" className="mt-1 font-mono">
                    <ui.SelectValue placeholder="Select method" />
                  </ui.SelectTrigger>
                  <ui.SelectContent>
                    {CRON_HTTP_METHODS.map((method) => (
                      <ui.SelectItem key={method} value={method}>
                        {method}
                      </ui.SelectItem>
                    ))}
                  </ui.SelectContent>
                </ui.Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <ui.Label htmlFor="cron-target-path">Target path *</ui.Label>
                <ui.Input
                  id="cron-target-path"
                  name="target_path"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  placeholder="/v1/jobs/push-to-drain"
                  required
                  disabled={isSubmitting}
                  className="mt-1 font-mono text-xs"
                  pattern="\/[^\s]+"
                />
              </div>

              <div>
                <ui.Label htmlFor="cron-target-scope">Scope *</ui.Label>
                <ui.Input
                  id="cron-target-scope"
                  name="target_scope"
                  value={targetScope}
                  onChange={(e) => {
                    setIsScopeManuallyEdited(true);
                    setTargetScope(e.target.value);
                  }}
                  placeholder="POST:/v1/jobs/push-to-drain"
                  required
                  disabled={isSubmitting}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <ui.Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </ui.Button>
              <ui.StatefulButton
                type="submit"
                overlayBusy
                busy={isSubmitting}
                disabled={isSubmitting}
              >
                <Plus className="mr-2 w-4 h-4" />
                Create Cron Job
              </ui.StatefulButton>
            </div>
          </fetcher.Form>
        </primitives.Card>
      )}
    </div>
  );
}
