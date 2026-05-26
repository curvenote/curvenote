import { Badge } from './badge.js';
import { cn } from '../../utils/cn.js';
import { VersionTagBadge } from './VersionTagBadge.js';

export type TagChipsProps = {
  tags?: string[] | null;
  /** Hide the leading tag icon. Defaults to false. */
  hideIcon?: boolean;
  /**
   * If set, only the first `limit` tags are shown and the remainder rendered as a `+N` overflow chip.
   */
  limit?: number;
  /** Optional title shown when hovering each chip. Falls back to the tag value. */
  titlePrefix?: string;
  className?: string;
};

/**
 * Read-only display of work-version / submission-version tags as chips.
 *
 * Composes {@link VersionTagBadge} so tag styling matches listing metadata badges
 * (DOI, version tag, etc.). Renders nothing when `tags` is empty.
 */
export function TagChips({ tags, hideIcon = false, limit, titlePrefix, className }: TagChipsProps) {
  if (!tags || tags.length === 0) return null;
  const visible = limit != null ? tags.slice(0, limit) : tags;
  const overflow = limit != null ? Math.max(0, tags.length - limit) : 0;
  return (
    <div className={cn('flex flex-wrap gap-1 items-center', className)}>
      {visible.map((tag) => (
        <VersionTagBadge key={tag} tag={tag} titlePrefix={titlePrefix} hideIcon={hideIcon} />
      ))}
      {overflow > 0 && (
        <Badge
          variant="outline-muted"
          size="xs"
          className="font-normal px-1.5 py-0"
          title={`${overflow} more tag${overflow === 1 ? '' : 's'}: ${tags.slice(limit).join(', ')}`}
        >
          +{overflow}
        </Badge>
      )}
    </div>
  );
}
