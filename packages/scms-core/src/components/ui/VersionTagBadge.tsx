import type { ComponentType, SVGProps } from 'react';
import { Tag } from 'lucide-react';
import { Badge } from './badge.js';
import { cn } from '../../utils/cn.js';

export type VersionTagBadgeEmphasis = 'outline' | 'solid' | 'latest' | 'previous' | 'on-primary';

type VersionTagBadgeIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type VersionTagBadgeProps = {
  tag: string;
  /** Tooltip text; defaults to `titlePrefix: tag` or the tag value. */
  title?: string;
  titlePrefix?: string;
  /** Hide the leading icon. */
  hideIcon?: boolean;
  /** Override the leading icon (defaults to `Tag`). */
  icon?: VersionTagBadgeIcon;
  /** Suppress the native title tooltip (use when wrapped in a popover/hover card). */
  disableTooltip?: boolean;
  /**
   * `outline` — muted outline badge (listings, timelines, DOI-adjacent metadata).
   * `solid` / `latest` / `previous` — filled badges for version emphasis (e.g. checks timeline).
   * `on-primary` — transparent badge with light text/border on primary buttons (dark text in dark mode).
   */
  emphasis?: VersionTagBadgeEmphasis;
  /** Tighter sizing for dense timeline rows (e.g. work timeline hover popover). */
  compact?: boolean;
  className?: string;
};

const filledEmphasisClassName: Record<
  Exclude<VersionTagBadgeEmphasis, 'outline' | 'on-primary'>,
  string
> = {
  solid: 'text-white bg-black dark:text-black dark:bg-white',
  latest: 'text-white bg-green-600 dark:text-white dark:bg-green-600',
  previous: 'text-white bg-gray-500 dark:text-white dark:bg-gray-500',
};

/** Transparent badge on primary buttons: light text in light mode, primary-foreground in dark. */
const onPrimaryEmphasisClassName =
  'border-white/80 bg-transparent text-white dark:border-primary-foreground/80 dark:text-primary-foreground';

function versionTagTitle(tag: string, title?: string, titlePrefix?: string) {
  if (title) return title;
  if (titlePrefix) return `${titlePrefix}: ${tag}`;
  return tag;
}

/**
 * Single work/submission version tag — leading icon plus tag label.
 * Used on listing rows and as the building block for {@link TagChips}.
 */
export function VersionTagBadge({
  tag,
  title,
  titlePrefix,
  hideIcon = false,
  icon: Icon = Tag,
  disableTooltip = false,
  emphasis = 'outline',
  compact = false,
  className,
}: VersionTagBadgeProps) {
  const label = disableTooltip ? undefined : versionTagTitle(tag, title, titlePrefix);

  if (emphasis === 'outline') {
    return (
      <Badge
        variant="outline-muted"
        size="xs"
        className={cn(
          'font-normal font-mono leading-none',
          compact ? 'h-[20px] gap-0.5 px-1 py-1' : 'px-1 py-1',
          className,
        )}
        title={label}
      >
        {!hideIcon ? <Icon className={compact ? 'size-[11px]' : 'size-3'} aria-hidden /> : null}
        {tag}
      </Badge>
    );
  }

  if (emphasis === 'on-primary') {
    return (
      <span
        className={cn(
          'inline-flex gap-1 items-center rounded-xs border font-mono font-normal leading-none',
          onPrimaryEmphasisClassName,
          compact ? 'h-[20px] py-1 text-[10px] px-1' : 'py-1.5 text-xs px-[6px]',
          className,
        )}
        title={label}
      >
        {!hideIcon ? (
          <Icon className={cn('shrink-0', compact ? 'size-[11px]' : 'size-3')} aria-hidden />
        ) : null}
        {tag}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex gap-1 items-center rounded-xs',
        compact ? 'h-[20px] py-1 text-[10px] px-1' : 'py-1.5 text-xs px-[6px]',
        filledEmphasisClassName[emphasis],
        className,
      )}
      title={label}
    >
      {!hideIcon ? (
        <Icon className={cn('shrink-0', compact ? 'size-[11px]' : 'size-3')} aria-hidden />
      ) : null}
      {tag}
    </span>
  );
}
