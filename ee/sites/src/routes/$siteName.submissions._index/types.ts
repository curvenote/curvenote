import type {
  SubmissionListingCollection,
  SubmissionListingKind,
} from '../$siteName.submissions-classic/types.js';

export type SubmissionsIndexItem = {
  id: string;
  title: string;
  authors: { name: string }[];
  datePublished?: string;
  dateFirstSubmitted: string;
  dateLastUpdated: string;
  doi?: string;
  versionTag?: string;
  queue?: string;
  queueStaff?: boolean;
  status: string;
  statusLabel: string;
  publishedVersion?: { date_created: string };
  retractedVersion?: { date_created: string };
  kind: SubmissionListingKind;
  collection: SubmissionListingCollection;
};

export type SubmissionsIndexPage = {
  items: SubmissionsIndexItem[];
  page: number;
  perPage: number;
  total: number;
};
