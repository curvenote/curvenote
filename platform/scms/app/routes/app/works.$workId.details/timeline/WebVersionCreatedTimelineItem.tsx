import { ExternalLink, Globe } from 'lucide-react';
import { DateWithPopover, TimelineItemPlain, useDeploymentConfig, ui } from '@curvenote/scms-core';

type WebVersionCreatedTimelineItemProps = {
  dateCreated: string;
  dateModified: string;
  workVersionId: string;
  /** Preview JWT minted server-side for this work version. */
  previewSignature: string;
};

function buildWebVersionPreviewHref(
  baseUrl: string,
  workVersionId: string,
  previewSignature: string,
): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}/previews/${workVersionId}?preview=${encodeURIComponent(previewSignature)}`;
}

/**
 * Timeline row when a work version has a MyST web build available.
 * Opens the work web-version preview theme with a signed preview token.
 */
export function WebVersionCreatedTimelineItem({
  dateCreated,
  dateModified,
  workVersionId,
  previewSignature,
}: WebVersionCreatedTimelineItemProps) {
  const { webVersionPreviewUrl } = useDeploymentConfig();
  const href = buildWebVersionPreviewHref(webVersionPreviewUrl, workVersionId, previewSignature);

  const date = (
    <DateWithPopover date={dateCreated} dateCreated={dateCreated} dateModified={dateModified} />
  );

  const trailing = (
    <ui.Button variant="link" asChild className="h-auto gap-1 p-0">
      <a href={href} target="_blank" rel="noopener noreferrer">
        Open
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </ui.Button>
  );

  return (
    <TimelineItemPlain
      icon={<Globe aria-hidden />}
      message={<>Web Version Created</>}
      date={date}
      trailing={trailing}
    />
  );
}
