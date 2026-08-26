const badgeClassName =
  'inline-flex shrink-0 items-center rounded-md bg-green-600 px-1.5 py-1 text-[10px] font-medium leading-none text-white dark:bg-green-600';

export function TaskCardNewBadge({ className }: { className?: string }) {
  return <span className={className ? `${badgeClassName} ${className}` : badgeClassName}>NEW</span>;
}

/** Reserve space for an absolutely positioned NEW badge in the top-right of the title block. */
export const TASK_CARD_TITLE_BADGE_PADDING = 'pr-11';
