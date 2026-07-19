import type { WorkflowTransition } from '@curvenote/scms-core';
import type { SiteLayoutSite } from '../$siteName/layout.format.server.js';

/** Site fields for submission detail chrome and preview URLs. */
export type SubmissionDetailSiteContext = SiteLayoutSite & { id: string };

export type SubmissionDetailKind = {
  id: string;
  name: string;
  content: { title?: string; [key: string]: unknown };
};

export type SubmissionDetailCollection = {
  id: string;
  name: string;
  workflow: string;
  content: { title?: string; name?: string; [key: string]: unknown };
};

export type SubmissionDetailSiteWork = {
  id: string;
  version_id: string;
  title: string;
  description?: string;
  authors: { name: string }[];
  doi?: string;
  key?: string;
  links: {
    thumbnail?: string;
    build?: string;
  };
};

export type SubmissionDetailVersion = {
  id: string;
  date_created: string;
  date_published?: string;
  status: string;
  tags?: string[];
  transition?: WorkflowTransition;
  submitted_by: { id: string; name: string };
  site_work: SubmissionDetailSiteWork;
  links: { build?: string };
};

export type SubmissionDetailJobFailure = {
  error: string;
  job_id?: string;
  job_type?: string;
  build_url?: string;
};

export type SubmissionDetailActivity = {
  id: string;
  date_created: string;
  activity_by: { name: string };
  activity_type: string;
  status?: string;
  kind?: string;
  submission_version?: { id: string; date_created: string };
  work_version?: { id: string; date_created: string };
  date_published?: string;
  job_failure?: SubmissionDetailJobFailure;
};

export type SubmissionDetailSubmission = {
  id: string;
  date_created: string;
  date_published?: string;
  slug?: string;
  kind: SubmissionDetailKind;
  collection: SubmissionDetailCollection;
  submitted_by: { id: string; name: string };
  active_version_id?: string;
  published_version_id?: string;
  retracted_version_id?: string;
  activity: SubmissionDetailActivity[];
};

export type SubmissionEditorKind = {
  id: string;
  name: string;
  content: { title?: string; [key: string]: unknown };
  default: boolean;
};

/** Collection + kinds for collection/kind pickers — no submission counts or API links. */
export type SubmissionEditorCollection = {
  id: string;
  name: string;
  content: { title?: string; name?: string; [key: string]: unknown };
  kinds: SubmissionEditorKind[];
};

/** Slug rows for the slug editor (not API SlugDTO). */
export type SubmissionDetailSlugRow = {
  id: string;
  slug: string;
  primary: boolean;
  date_created: string;
  date_modified: string;
};

export type SiteAppData = {
  magicLinksEnabled?: boolean;
};

/** Site fields for magic links UI — not public SiteDTO. */
export type SiteWithAppData = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  private: boolean;
  restricted: boolean;
  data: SiteAppData | null;
};

export type MagicLinkWithAccessCount = {
  id: string;
  date_created: string;
  date_modified: string;
  created_by_id: string;
  type: string;
  data: unknown;
  expiry: string | null;
  revoked: boolean;
  access_limit: number | null;
  access_count: number;
};
