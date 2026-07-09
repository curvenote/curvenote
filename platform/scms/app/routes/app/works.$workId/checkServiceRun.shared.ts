/** Check service run row for timeline and summaries (client + server safe). */
export type CheckServiceRunRow = {
  id: string;
  work_version_id: string;
  kind: string;
  date_created: string;
  date_modified: string;
  data: unknown;
  created_by_id: string | null;
  retried?: boolean;
  successor_id?: string | null;
};

/** True when a failed run was superseded by a retry and should not appear in summaries. */
export function isCheckServiceRunSupersededByRetry(
  run: Pick<CheckServiceRunRow, 'retried' | 'successor_id'>,
): boolean {
  return run.retried === true || Boolean(run.successor_id?.trim());
}
