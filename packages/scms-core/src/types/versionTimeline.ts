export type VersionTimelineEntry = {
  id: string;
  date_created: string;
  date_modified: string;
  date_published?: string;
  status: string;
  statusLabel: string;
  tag?: string;
};

export type WorkVersionTimelineEntry = {
  id: string;
  date_created: string;
  date_modified: string;
  draft: boolean;
  tag?: string;
};

export type VersionTimelineResponse<T = VersionTimelineEntry> = {
  versions: T[];
};
