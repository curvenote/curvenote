/** Narrow kind shape for listing chips. */
export type SubmissionListingKind = {
  id: string;
  name: string;
  content: { title?: string; [key: string]: unknown };
};

/** Narrow collection shape for listing chips. */
export type SubmissionListingCollection = {
  id: string;
  name: string;
  slug: string;
  workflow: string;
  open: boolean;
  content: { title?: string; [key: string]: unknown };
};

export type SubmissionsIndexItem = {
  id: string;
  title: string;
  authors: { name: string }[];
  datePublished?: string;
  dateFirstSubmitted: string;
  dateLastUpdated: string;
  doi?: string;
  versionTag?: string;
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
