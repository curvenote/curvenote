import { hyphenatedFromDate, hyphenatedToDate } from '@curvenote/scms-core';

export type SubmissionItem = {
  versions: {
    status: string;
    date_created?: string | null;
    work_version?: {
      date?: string | null;
    };
  }[];
};

export function firstPublishedVersionDateCreated(item: SubmissionItem) {
  const version = item.versions.reverse().find((v) => v.status === 'PUBLISHED');
  const date = version?.date_created;
  if (!date) return undefined;
  return hyphenatedFromDate(hyphenatedToDate(date));
}

export function lastPublishedVersionWorkDate(item: SubmissionItem) {
  const version = item.versions.find((v) => v.status === 'PUBLISHED');
  const date = version?.work_version?.date;
  if (!date) return undefined;
  return hyphenatedFromDate(hyphenatedToDate(date));
}
