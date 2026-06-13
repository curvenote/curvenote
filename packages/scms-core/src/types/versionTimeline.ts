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
  tag?: string;
  submissionVersions?: WorkVersionTimelineSubmissionVersion[];
};

export type VersionTimelineResponse<T = VersionTimelineEntry> = {
  versions: T[];
};
