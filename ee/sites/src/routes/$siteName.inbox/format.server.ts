import type { InboxActivityItem, InboxActivityRow } from './db.server.js';

export function formatInboxActivity(row: InboxActivityRow): InboxActivityItem {
  const newestVersion = row.submission?.versions[0];
  const title = newestVersion?.work_version.title?.trim();

  return {
    id: row.id,
    date_created: row.date_created,
    activity_type: row.activity_type,
    activity_by: { name: row.activity_by.display_name?.trim() || 'Unknown' },
    status: row.status ?? undefined,
    data: (row.data as Record<string, unknown> | null) ?? null,
    transition: (row.transition as Record<string, unknown> | null) ?? null,
    submission: row.submission
      ? {
          id: row.submission.id,
          title: title || 'Untitled submission',
        }
      : undefined,
  };
}

export function formatInboxActivities(rows: InboxActivityRow[]): InboxActivityItem[] {
  return rows.map(formatInboxActivity);
}
