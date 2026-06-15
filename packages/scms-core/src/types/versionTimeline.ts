export type VersionTimelineEntry = {
  id: string;
  date_created: string;
  date_modified: string;
  date_published?: string;
  status: string;
  statusLabel: string;
  tag?: string;
};

export type WorkVersionTimelineSubmissionVersion = {
  id: string;
  submissionId: string;
  status: string;
  statusLabel: string;
  date_published?: string;
  /** First submission-version tag (e.g. v2), not workflow status tags. */
  tag?: string;
  /** Workflow state tags — used for status accent on compact site chips. */
  statusTags?: string[];
  site: {
    name: string;
    title?: string;
    logo?: string;
  };
};

export type WorkVersionTimelineEntry = {
  id: string;
  date_created: string;
  date_modified: string;
  draft: boolean;
  submissionVersions?: WorkVersionTimelineSubmissionVersion[];
};

export type VersionTimelineDisplayItem<T> =
  | { type: 'version'; version: T }
  | { type: 'gap'; hiddenCount: number };

/** Compact lazy-load payload for version timeline hover cards (trimmed server-side). */
export type TrimmedVersionTimeline<T = VersionTimelineEntry> = {
  total: number;
  hidden: number;
  seeAllHref: string;
  items: VersionTimelineDisplayItem<T>[];
};

export type VersionTimelineResponse<T = VersionTimelineEntry> = TrimmedVersionTimeline<T>;
