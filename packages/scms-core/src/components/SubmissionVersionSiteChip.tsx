import { Link } from 'react-router';
import type { WorkVersionTimelineSubmissionVersion } from '../types/versionTimeline.js';
import { formatDate, formatDatetime } from '../utils/formatDate.js';
import { getStatusRingClasses } from '../utils/status.js';
import { cn } from '../utils/cn.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js';

function SiteMark({ site }: { site: WorkVersionTimelineSubmissionVersion['site'] }) {
  if (site.logo) {
    return (
      <img src={site.logo} alt="" className="object-contain size-4 max-w-4 max-h-4" aria-hidden />
    );
  }

  return (
    <span
      className="flex justify-center items-center size-4 text-[9px] font-semibold uppercase text-muted-foreground"
      aria-hidden
    >
      {site.name.slice(0, 1)}
    </span>
  );
}

function chipDetailLabel(submissionVersion: WorkVersionTimelineSubmissionVersion): {
  label: string;
  kind: 'tag' | 'date' | 'status';
} {
  if (submissionVersion.tag) {
    return { label: submissionVersion.tag, kind: 'tag' };
  }
  if (submissionVersion.date_published) {
    return { label: formatDate(submissionVersion.date_published), kind: 'date' };
  }
  return { label: submissionVersion.statusLabel, kind: 'status' };
}

export function SubmissionVersionSiteChip({
  submissionVersion,
  workId,
}: {
  submissionVersion: WorkVersionTimelineSubmissionVersion;
  workId?: string;
}) {
  const siteLabel = submissionVersion.site.title || submissionVersion.site.name;
  const { label: detailLabel, kind: detailKind } = chipDetailLabel(submissionVersion);
  const href = workId
    ? `/app/works/${workId}/site/${submissionVersion.site.name}/submission/${submissionVersion.id}`
    : undefined;

  const chip = (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center justify-center gap-1 rounded-md ring-1 px-1.5',
        getStatusRingClasses(submissionVersion.statusTags),
        href && 'transition-opacity hover:opacity-80',
      )}
    >
      <SiteMark site={submissionVersion.site} />
      <span className="w-px h-3 bg-border/80 shrink-0" aria-hidden />
      <span
        className={cn(
          'text-[10px] leading-4 text-foreground/90',
          detailKind === 'tag' && 'font-mono',
        )}
      >
        {detailLabel}
      </span>
    </span>
  );

  const ariaLabel = `${siteLabel}: ${submissionVersion.statusLabel}${
    submissionVersion.tag ? `, ${submissionVersion.tag}` : ''
  }`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Link
            to={href}
            className="inline-flex items-center"
            aria-label={ariaLabel}
            onClick={(event) => event.stopPropagation()}
          >
            {chip}
          </Link>
        ) : (
          <span className="inline-flex items-center cursor-default">{chip}</span>
        )}
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>
        <span className="font-medium">{siteLabel}</span>
        <span className="text-muted-foreground"> · {submissionVersion.statusLabel}</span>
        {submissionVersion.tag ? (
          <span className="text-muted-foreground"> · {submissionVersion.tag}</span>
        ) : null}
        {submissionVersion.date_published ? (
          <span className="text-muted-foreground">
            {' '}
            · Publication date · {formatDatetime(submissionVersion.date_published)}
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
