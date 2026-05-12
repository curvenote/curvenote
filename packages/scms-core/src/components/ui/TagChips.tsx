import { Tag as TagIcon } from 'lucide-react';
import { Badge } from './badge.js';
import { cn } from '../../utils/cn.js';

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
 * Mirrors the existing `outline-muted` badge styling used elsewhere on cards
 * so tags blend with DOI/Slug/etc. badges. Renders nothing when `tags` is
 * empty so callers can drop it in unconditionally.
 */
export function TagChips({
  tags,
  hideIcon = false,
  limit,
  titlePrefix,
  className,
}: TagChipsProps) {
  if (!tags || tags.length === 0) return null;
  const visible = limit != null ? tags.slice(0, limit) : tags;
  const overflow = limit != null ? Math.max(0, tags.length - limit) : 0;
  return (
    <div className={cn('flex flex-wrap gap-1 items-center', className)}>
      {!hideIcon && (
        <TagIcon
          className="size-3 text-muted-foreground shrink-0"
          aria-hidden
        />
      )}
      {visible.map((tag) => (
        <Badge
          key={tag}
          variant="outline-muted"
          size="xs"
          className="font-normal px-1.5 py-0"
          title={titlePrefix ? `${titlePrefix}: ${tag}` : tag}
        >
          {tag}
        </Badge>
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
