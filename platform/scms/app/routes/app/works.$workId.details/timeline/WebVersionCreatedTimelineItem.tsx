import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Await, useFetcher, useRevalidator } from 'react-router';
import { ExternalLink, Globe, Loader2, RotateCcw } from 'lucide-react';
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
      ui.toastInfo('Web conversion re-queued');
      revalidator.revalidate();
    }
  }, [retryFetcher.state, retryFetcher.data, revalidator]);

  const model = resolveWebConversionTimelineModel({
    available,
    versionDateCreated: dateCreated,
    versionDateModified: dateModified,
    latestJob: pickLatestWebConversionJob(linkedJobs),
  });

  if (!model) return null;

  const retryBusy = retryFetcher.state !== 'idle';
  const href =
    previewSignature != null
      ? buildWorkVersionPreviewHref(workVersionPreviewUrl, workVersionId, previewSignature)
      : null;

  let message: ReactNode;
  if (model.phase === 'building') {
    message = <>Web Version building…</>;
  } else if (model.phase === 'failed') {
    message = (
      <>
        Web Version failed
        {model.error ? <span className="text-muted-foreground"> — {model.error}</span> : null}
      </>
    );
  } else {
    message = <>Web Version Created</>;
  }

  const date = (
    <DateWithPopover
      date={model.dateCreated}
      dateCreated={model.dateCreated}
      dateModified={model.dateModified}
    />
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
      {model.canRetry ? (
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
      muted={model.phase === 'building' || model.phase === 'failed'}
    />
  );
}

/**
 * Timeline row for MyST web preview lifecycle:
 * appears when conversion starts, shows building/failed status with Retry, and View when available.
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
