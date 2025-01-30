import type { FileUploadResponse, UploadFileInfo } from '@curvenote/blocks';
export type { UploadFileInfo, FileUploadResponse } from '@curvenote/blocks';
import type { CheckDTO } from './checks.js';
import type { JournalThemeConfig } from './journal.js';
import type { MystPlugin } from 'myst-common';
export * from './journal.js';
export * from './checks.js';

export type HostSpec = { cdn: string; key: string; query?: string };
export type Host = string | HostSpec;

export interface Author {
  name: string;
  orcid?: string;
}

export type SocialSite =
  | 'twitter'
  | 'mastodon'
  | 'linkedin'
  | 'github'
  | 'slack'
  | 'email'
  | 'discord'
  | 'website'
  | 'youtube'
  | 'discourse';

export type SocialLink = {
  kind: SocialSite | string;
  url: string;
  title?: string;
};

export type FooterLink = {
  url: string;
  title: string;
  external?: boolean;
};

export type Site = SiteConfig; // TODO deprecate
export type SiteConfig = {
  name: string;
  default_workflow: string;
  title: string;
  description: string;
  content: Host;
  private: boolean;
  restricted: boolean;
  favicon?: string;
  tagline?: string;
  logo: string;
  logo_dark?: string;
  footer_logo?: string;
  footer_logo_dark?: string;
  footer_links?: FooterLink[][];
  social_links?: SocialLink[];
  theme_config?: JournalThemeConfig;
  collections: CollectionSummaryDTO[]; // is this needed on the site?
};

export type SiteListingDTO = {
  items: SiteDTO[];
  links: {
    self: string;
  };
};

export type SiteDTO = SiteConfig & {
  id: string;
  url: string;
  links: {
    self: string;
    html: string;
    collections: string;
    works: string;
  };
};

export type CollectionSummaryDTO = {
  id: string;
  name: string;
  slug: string;
  workflow: string;
  content: { title?: string; description?: string } & Record<string, any>;
  open: boolean;
};

export type CollectionDTO = CollectionSummaryDTO & {
  default: boolean;
  kinds: Omit<SubmissionKindDTO, 'date_created' | 'date_modified' | 'checks'>[];
  date_created: string;
  date_modified: string;
  num_published: number;
  parent_id?: string;
  links: {
    self: string;
    site: string;
  };
};

export type CollectionListingDTO = {
  items: CollectionDTO[];
  links: {
    self: string;
  };
};

export type Work = {
  id: string;
  version_id?: string;
  key?: string;
  date_created: string;
  doi?: string;
} & Partial<WorkVersion>;

export type WorkVersion = {
  id: string;
  date_created: string;
  cdn: string;
  cdn_key: string;
  cdn_query?: string;
  title: string;
  authors: Author[];
  description?: string;
  date?: string;
  doi?: string;
  collection: Pick<CollectionDTO, 'id' | 'name' | 'slug' | 'content' | 'open' | 'workflow'>;
  canonical?: boolean;
};

/**
 * A "SiteWork" is a representation of a version of a work that is associated with a specific site and submission
 * It blends the information from the work and the work version, adding in the site and submission specific fields
 */
export type SiteWorkDTO = Pick<SubmissionDTO, 'slug' | 'kind'> &
  Work & {
    submission_version_id: string;
    links: {
      self: string;
      config: string;
      site: string;
      work: string;
      thumbnail: string;
      social: string;
      doi?: string;
    };
  };

export type SiteWorkListingDTO = {
  items: SiteWorkDTO[];
  total: number;
  links: {
    self: string;
    site: string;
    prev?: string;
    next?: string;
  };
};

export type WorkDTO = Work & {
  links: {
    self: string;
    versions: string;
    config?: string;
    doi?: string;
    thumbnail?: string;
    social?: string;
  };
};

export type WorksDTO = {
  items: WorkDTO[];
  links: {
    self: string;
  };
};

export type WorkVersionDTO = WorkVersion & {
  work_id: string;
  links: {
    self: string;
    work: string;
    thumbnail?: string;
    social?: string;
    config?: string;
  };
};

export type WorkVersionsDTO = {
  items: WorkVersionDTO[];
  links: {
    self: string;
    work: string;
  };
};

export type SubmissionActivityDTO = {
  id: string;
  date_created: string;
  activity_by: {
    id: string;
    name: string;
  };
  submission_id: string;
  activity_type: string;
  status?: string;
  submission_version: {
    id: string;
    date_created: string;
  };
  work_version?: {
    id: string;
    date_created: string;
  };
  kind?: string;
  links: {
    self: string;
    submission: string;
  };
};

export type SubmissionVersionDTO = {
  id: string;
  date_created: string;
  status: string;
  submission_id: string;
  kind: SubmissionKindSummaryDTO; // string is deprecated
  collection: Pick<CollectionDTO, 'id' | 'name' | 'slug' | 'content' | 'open' | 'workflow'>;
  submitted_by: {
    id: string;
    name: string;
  };
  site_name: string;
  site_work: SiteWorkDTO;
  job_id?: string;
  links: {
    self: string;
    site: string;
    submission: string;
    work: string;
    thumbnail?: string;
    build?: string;
  };
};

export type SubmissionVersionListingDTO = {
  items: SubmissionVersionDTO[];
  total: number;
  links: {
    self: string;
    site: string;
    submission: string;
    prev?: string;
    next?: string;
  };
};

export type SubmissionLinksDTO = {
  self: string;
  site: string;
  versions: string;
  thumbnail: string;
  build?: string;
  work: string;
  publish?: string;
  unpublish?: string;
};

export type SubmissionDTO = {
  id: string;
  date_created: string;
  kind: SubmissionKindSummaryDTO; // string is deprecated
  submitted_by: {
    id: string;
    name: string;
  };
  site_name: string;
  slug?: string;
  active_version_id: string;
  published_version_id?: string;
  retracted_version_id?: string;
  activity: SubmissionActivityDTO[];
  collection: Pick<CollectionDTO, 'id' | 'name' | 'slug' | 'content' | 'open' | 'workflow'>;
  links: SubmissionLinksDTO;
};

export type SubmissionVersionSummaryDTO = {
  id: string;
  date_created: string;
  status: string;
  submitted_by: {
    id: string;
    name: string;
  };
  work_id: string;
  work_version_id: string;
  job_id?: string;
};

export type SubmissionsListItemDTO = {
  id: string;
  date_created: string;
  kind: SubmissionKindSummaryDTO; // deprecated
  collection: Pick<CollectionDTO, 'id' | 'name' | 'slug' | 'content' | 'open' | 'workflow'>;
  slug: string;
  submitted_by: {
    id: string;
    name: string;
  };
  site_name: string;
  title: string;
  authors: Author[];
  description?: string;
  date?: string;
  doi?: string;
  status: string;
  job_id?: string;
  version_id: string;
  // TODO latest status, best status, etc.
  active_version: SubmissionVersionSummaryDTO;
  published_version?: SubmissionVersionSummaryDTO;
  retracted_version?: SubmissionVersionSummaryDTO;
  num_versions: number;
  last_activity: {
    date: string;
    by: {
      id: string;
      name: string;
    };
  };
  links: SubmissionLinksDTO;
};

export type SubmissionsListingDTO = {
  items: SubmissionsListItemDTO[];
  links: {
    self: string;
    site: string;
  };
};

export type MySubmissionsListingDTO = {
  items: SubmissionsListItemDTO[];
  links: {
    self: string;
  };
};

export type MyUserDTO = {
  id: string;
  email: string;
  display_name: string;
  system_role: string;
  site_roles: {
    role: string;
    site: {
      id: string;
      name: string;
      title: string;
    };
  }[];
  links: {
    self: string;
  };
};

export type UserSiteDTO = SiteDTO & { role: string | null };
export type UserSitesDTO = {
  items: UserSiteDTO[];
  links: {
    self: string;
    user: string;
  };
};

export type SubmissionKindSummaryDTO = {
  id: string;
  name: string;
  content: { title?: string; description?: string } & Record<string, any>;
  default: boolean;
};

export type SubmissionKindDTO = SubmissionKindSummaryDTO & {
  checks: CheckDTO[];
  date_created: string;
  date_modified: string;
  links: {
    self: string;
    site: string;
  };
};

export type SubmissionKindListingDTO = {
  items: SubmissionKindDTO[];
  links: {
    self: string;
    site: string;
    submission_cdn: string;
  };
};

type JsonValue = string | boolean | any[] | Record<string, any>;

export type JobDTO = {
  id: string;
  date_created: string;
  date_modified: string;
  job_type: string;
  status: string;
  payload: JsonValue;
  results?: JsonValue;
  messages: string[];
  links: {
    self: string;
  };
};

export type JobCreatePostBody = {
  job_type: 'CHECK';
  payload: JsonValue;
};

export type JobUpdatePatchBody = {
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  message?: string;
  results?: JsonValue;
};

export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export type UploadStagingDTO = {
  cdnKey: string;
  cached_items: UploadFileInfo[];
  upload_items: FileUploadResponse[];
};

export type CurvenotePlugin = MystPlugin & {
  // TODO CheckInterface
  checks?: any[];
};

export type ValidatedCurvenotePlugin = Required<
  Pick<CurvenotePlugin, 'directives' | 'roles' | 'transforms' | 'checks'>
>;
