export type VersionTimelineEntry = {
  id: string;
  date_created: string;
  date_modified: string;
  date_published?: string;
  status: string;
  statusLabel: string;
  tag?: string;
};

export type VersionTimelineResponse = {
  versions: VersionTimelineEntry[];
};
