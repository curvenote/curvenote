import type { BaseLog, IdAndDate, BaseOpts } from '../logs/types.js';

export type PushOpts = BaseOpts & {
  public?: boolean;
};

export type RegisterWorkOpts = BaseOpts & {
  venue: string;
  /** Absolute or relative path to myst.yml / curvenote.yml (default: detect in cwd). */
  contentYaml?: string;
  key?: 'id' | 'doi';
  kind?: string;
  collection?: string;
  title?: string;
  cdn?: string;
  cdnKey?: string;
  draft?: boolean;
  workMetadata?: string;
  submissionMetadata?: string;
  source?: string;
  new?: boolean;
  tags?: string[];
};

export type WorkPushLog = BaseLog & {
  work?: IdAndDate;
  workVersion?: IdAndDate;
  key?: string;
};
