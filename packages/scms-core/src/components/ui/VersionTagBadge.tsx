import type { ComponentType, SVGProps } from 'react';
import { Tag } from 'lucide-react';
import { Badge } from './badge.js';
import { cn } from '../../utils/cn.js';

export type VersionTagBadgeEmphasis = 'outline' | 'solid' | 'latest' | 'previous';

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
   */
  emphasis?: VersionTagBadgeEmphasis;
  className?: string;
};

const filledEmphasisClassName: Record<Exclude<VersionTagBadgeEmphasis, 'outline'>, string> = {
  solid: 'text-white bg-black dark:text-black dark:bg-white',
  latest: 'text-white bg-green-600 dark:text-white dark:bg-green-600',
  previous: 'text-white bg-gray-500 dark:text-white dark:bg-gray-500',
};

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
  className,
}: VersionTagBadgeProps) {
  const label = disableTooltip ? undefined : versionTagTitle(tag, title, titlePrefix);

  if (emphasis === 'outline') {
    return (
      <Badge
        variant="outline-muted"
        size="xs"
        className={cn('font-normal px-1 py-0.5 font-mono', className)}
        title={label}
      >
        {!hideIcon ? <Icon className="size-3" aria-hidden /> : null}
        {tag}
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex gap-1 items-center py-1 text-xs px-[6px] rounded-xs',
        filledEmphasisClassName[emphasis],
        className,
      )}
      title={label}
    >
      {!hideIcon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
      {tag}
    </span>
  );
}
