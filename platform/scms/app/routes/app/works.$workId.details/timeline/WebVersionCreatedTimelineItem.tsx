import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Await, useFetcher, useRevalidator } from 'react-router';
import { ExternalLink, Globe, InfoIcon, Loader2, RotateCcw } from 'lucide-react';
import { DateWithPopover, TimelineItemPlain, useDeploymentConfig, ui } from '@curvenote/scms-core';
import type { LinkedJobsByWorkVersionId } from '../types';
import { pickLatestWebConversionJob, resolveWebConversionTimelineModel } from '../webConversionJob';

type WebVersionCreatedTimelineItemProps = {
  dateCreated: string;
  dateModified: string;
  workVersionId: string;
  basePath: string;
  /** Preview JWT minted server-side when MyST web is available. */
  previewSignature?: string;
  /** True when version has cdn + cdn_key + contains MYST. */
  available: boolean;
  linkedJobsByWorkVersionIdPromise: Promise<LinkedJobsByWorkVersionId>;
};

function buildWorkVersionPreviewHref(
  baseUrl: string,
  workVersionId: string,
  previewSignature: string,
): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}/previews/${workVersionId}?preview=${encodeURIComponent(previewSignature)}`;
}

type WebVersionRowProps = {
  dateCreated: string;
  dateModified: string;
  workVersionId: string;
  basePath: string;
  previewSignature?: string;
  available: boolean;
  linkedJobs: LinkedJobsByWorkVersionId[string];
};

function WebVersionRow({
  dateCreated,
  dateModified,
  workVersionId,
  basePath,
  previewSignature,
  available,
  linkedJobs,
}: WebVersionRowProps) {
  const { workVersionPreviewUrl } = useDeploymentConfig();
  const retryFetcher = useFetcher<{
    success?: boolean;
    jobId?: string;
    error?: { type: string; message: string };
  }>();
  const revalidator = useRevalidator();
  const lastHandledRetryDataRef = useRef<unknown>(undefined);
  /** Job id from a successful Retry — forces queued until that job appears in linkedJobs. */
  const [optimisticJobId, setOptimisticJobId] = useState<string | null>(null);

  useEffect(() => {
    if (retryFetcher.state !== 'idle' || !retryFetcher.data) return;
    if (lastHandledRetryDataRef.current === retryFetcher.data) return;
    lastHandledRetryDataRef.current = retryFetcher.data;
    const d = retryFetcher.data;
    if (d.error?.message) {
      ui.toastError(d.error.message);
      return;
    }
    if (d.success === true) {
      if (typeof d.jobId === 'string') setOptimisticJobId(d.jobId);
      ui.toastInfo('Web conversion re-queued');
      revalidator.revalidate();
    }
  }, [retryFetcher.state, retryFetcher.data, revalidator]);

  const latestJob = pickLatestWebConversionJob(linkedJobs);

  useEffect(() => {
    if (!optimisticJobId) return;
    if (latestJob?.id === optimisticJobId) {
      setOptimisticJobId(null);
    }
  }, [latestJob?.id, optimisticJobId]);

  const model = resolveWebConversionTimelineModel({
    available,
    versionDateCreated: dateCreated,
    versionDateModified: dateModified,
    latestJob,
  });

  if (!model && !optimisticJobId) return null;

  const retryBusy = retryFetcher.state !== 'idle';
  const forceQueued = optimisticJobId != null && latestJob?.id !== optimisticJobId;
  const phase = forceQueued ? 'queued' : (model?.phase ?? 'queued');
  const error = phase === 'failed' ? model?.error : undefined;
  const canRetry = phase === 'failed';
  const statusDateCreated = model?.dateCreated ?? dateCreated;
  const statusDateModified = model?.dateModified ?? dateModified;

  const href =
    previewSignature != null
      ? buildWorkVersionPreviewHref(workVersionPreviewUrl, workVersionId, previewSignature)
      : null;

  const message = phase === 'available' ? <>Web Version Ready</> : <>Web Version</>;

  let status: ReactNode = null;
  if (phase === 'queued') {
    status = <span className="text-muted-foreground">queued</span>;
  } else if (phase === 'building') {
    status = <span className="text-muted-foreground">building…</span>;
  } else if (phase === 'failed') {
    status = (
      <span className="inline-flex items-center gap-1 text-destructive">
        <span>failed</span>
        {error ? (
          <ui.SimpleTooltip
            title={error}
            side="top"
            sideOffset={6}
            delayDuration={200}
            className="max-w-sm text-left whitespace-normal"
          >
            <button
              type="button"
              className="inline-flex shrink-0 text-destructive hover:opacity-80"
              aria-label="Conversion error details"
            >
              <InfoIcon className="size-3.5" aria-hidden />
            </button>
          </ui.SimpleTooltip>
        ) : null}
      </span>
    );
  }

  const date = (
    <span className="inline-flex items-center gap-2">
      {status}
      <DateWithPopover
        date={statusDateCreated}
        dateCreated={statusDateCreated}
        dateModified={statusDateModified}
      />
    </span>
  );

  const trailing = (
    <div className="flex items-center gap-3">
      {available && href != null ? (
        <ui.Button variant="link" asChild className="h-auto gap-1 p-0">
          <a href={href} target="_blank" rel="noopener noreferrer">
            View
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </ui.Button>
      ) : null}
      {canRetry ? (
        <ui.Button
          type="button"
          variant="link"
          className="h-auto gap-1 p-0"
          disabled={retryBusy}
          onClick={() => {
            if (retryBusy) return;
            retryFetcher.submit(
              { intent: 'retry-web-conversion', workVersionId },
              { method: 'post', action: basePath },
            );
          }}
        >
          {retryBusy ? (
            <>
              Retrying…
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            </>
          ) : (
            <>
              Retry
              <RotateCcw className="size-3.5" aria-hidden />
            </>
          )}
        </ui.Button>
      ) : null}
    </div>
  );

  return (
    <TimelineItemPlain
      icon={<Globe aria-hidden />}
      message={message}
      date={date}
      trailing={trailing}
    />
  );
}

/**
 * Timeline row for web preview lifecycle (converter jobs with target=web):
 * queued → building → failed (Retry) or available (View).
 */
export function WebVersionCreatedTimelineItem({
  dateCreated,
  dateModified,
  workVersionId,
  basePath,
  previewSignature,
  available,
  linkedJobsByWorkVersionIdPromise,
}: WebVersionCreatedTimelineItemProps) {
  return (
    <Suspense fallback={null}>
      <Await resolve={linkedJobsByWorkVersionIdPromise} errorElement={null}>
        {(resolved: LinkedJobsByWorkVersionId) => (
          <WebVersionRow
            dateCreated={dateCreated}
            dateModified={dateModified}
            workVersionId={workVersionId}
            basePath={basePath}
            previewSignature={previewSignature}
            available={available}
            linkedJobs={resolved[workVersionId] ?? []}
          />
        )}
      </Await>
    </Suspense>
  );
}
