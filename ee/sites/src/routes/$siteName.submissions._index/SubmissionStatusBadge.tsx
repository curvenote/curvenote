import { cn, getStatusButtonClasses, HistoryDraftIcon } from '@curvenote/scms-core';

export function SubmissionStatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        getStatusButtonClasses(status),
        'inline-flex items-center justify-center rounded-sm px-2 py-[2px] text-sm opacity-90',
      )}
      aria-label={`Status: ${label}`}
    >
      <HistoryDraftIcon size={16} />
      <span className="mx-1 inline-flex">{label}</span>
    </span>
  );
}
