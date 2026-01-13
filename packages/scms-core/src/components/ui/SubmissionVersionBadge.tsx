import React from 'react';
import { Link } from 'react-router';
import { Badge } from './badge.js';
import type { Workflow } from '../../workflow/types.js';
import { cn } from '../../utils/cn.js';

type SubmissionVersion = {
  id: string;
  status: string;
  submission: {
    id: string;
    collection: {
      workflow: string;
    };
    site: {
      name: string;
      title?: string;
      metadata?: any;
    };
  };
};

type SubmissionVersionBadgeProps = {
  submissionVersion: SubmissionVersion;
  workflows: Record<string, Workflow>;
  basePath: string;
  workVersionId: string;
  showSite?: boolean;
  showLink?: boolean;
  variant?: 'outline' | 'default';
};

export function SubmissionVersionBadge({
  submissionVersion: sv,
  workflows,
  basePath,
  workVersionId,
  showSite = false,
  showLink = false,
  variant = 'default',
}: SubmissionVersionBadgeProps) {
  // If showSite is true, showLink should also be true
  // Otherwise, use the explicit showLink value or default to true
  const shouldShowLink = showSite ? true : (showLink ?? true);
  const workflow = workflows[sv.submission.collection.workflow];
  const state = workflow?.states[sv.status];
  const statusLabel = state?.label ?? sv.status;
  const site = sv.submission.site;

  // Get badge variant for default styling (solid colors)
  const getDefaultBadgeVariant = (): 'outline' | 'destructive' | 'success' | 'warning' => {
    if (!state?.tags) return 'outline';

    const hasEnd = state.tags.includes('end');
    const hasError = state.tags.includes('error');
    const hasWarning = state.tags.includes('warning');

    if (hasError) return 'destructive';
    if (hasWarning) return 'warning';
    if (hasEnd && !hasError && !hasWarning) return 'success';

    return 'outline';
  };

  // Additional classes for outline variant (transparent background colors)
  const getOutlineStatusClasses = () => {
    if (!state?.tags) return '';

    const hasEnd = state.tags.includes('end');
    const hasError = state.tags.includes('error');
    const hasWarning = state.tags.includes('warning');

    if (hasError) {
      return 'bg-red-100 [a&]:hover:!bg-red-200 dark:bg-red-900/60 dark:[a&]:hover:!bg-red-900/80';
    }
    if (hasWarning) {
      return 'bg-orange-100 [a&]:hover:!bg-orange-200 dark:bg-orange-900/60 dark:[a&]:hover:!bg-orange-900/80';
    }
    if (hasEnd && !hasError && !hasWarning) {
      return 'bg-green-100 [a&]:hover:!bg-green-200 dark:bg-green-900/60 dark:[a&]:hover:!bg-green-900/80';
    }

    return '';
  };

  const badgeContent = (
    <>
      <span className="">{statusLabel}</span>
      {showSite && <span className="">@</span>}
      {showSite &&
        site?.metadata &&
        typeof site.metadata === 'object' &&
        'logo' in site.metadata && (
          <img
            src={site.metadata.logo as string}
            alt={site.title}
            className="object-contain w-4 h-4"
          />
        )}
      {showSite && <span>{site?.title || site?.name}</span>}
    </>
  );

  return (
    <Badge
      variant={variant === 'default' ? getDefaultBadgeVariant() : 'outline'}
      key={`badge-${workVersionId}-${sv.id}`}
      className={cn('transition-colors gap-[2px]', {
        [getOutlineStatusClasses()]: variant === 'outline',
        'cursor-pointer': shouldShowLink,
      })}
      asChild={shouldShowLink}
      title={`SID: ${sv.submission.id}\nSVID: ${sv.id}`}
    >
      {shouldShowLink ? (
        <Link
          key={`link-${workVersionId}-${sv.id}`}
          to={`${basePath}/site/${sv.submission.site.name}/submission/${sv.id}`}
          aria-label={`View submission for ${sv.submission.site.title || sv.submission.site.name}`}
          tabIndex={0}
        >
          {badgeContent}
        </Link>
      ) : (
        <div>{badgeContent}</div>
      )}
    </Badge>
  );
}
