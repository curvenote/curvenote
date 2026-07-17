import { ArrowRight, Globe } from 'lucide-react';
import { DateWithPopover, TimelineItemPlain, useDeploymentConfig, ui } from '@curvenote/scms-core';

type WebVersionCreatedTimelineItemProps = {
  dateCreated: string;
  dateModified: string;
  workVersionId: string;
};

function buildWebVersionPreviewHref(baseUrl: string, workVersionId: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}/works/${workVersionId}`;
}

/**
 * Timeline row when a work version has a MyST web build available.
 * Distinct from submission previews — opens the work web-version preview theme.
 */
export function WebVersionCreatedTimelineItem({
  dateCreated,
  dateModified,
  workVersionId,
}: WebVersionCreatedTimelineItemProps) {
  const { webVersionPreviewUrl } = useDeploymentConfig();
  const href = webVersionPreviewUrl
    ? buildWebVersionPreviewHref(webVersionPreviewUrl, workVersionId)
    : undefined;

  const date = (
    <DateWithPopover date={dateCreated} dateCreated={dateCreated} dateModified={dateModified} />
  );

  const trailing = href ? (
    <ui.Button variant="outline" size="sm" className="gap-1.5" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Open
        <ArrowRight className="size-3.5" aria-hidden />
      </a>
    </ui.Button>
  ) : undefined;

  return (
    <TimelineItemPlain
      icon={<Globe aria-hidden />}
      message={<>Web Version Created</>}
      date={date}
      trailing={trailing}
    />
  );
}
