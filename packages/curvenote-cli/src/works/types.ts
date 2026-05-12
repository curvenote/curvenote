import type { BaseLog, IdAndDate, BaseOpts } from '../logs/types.js';

export type PushOpts = BaseOpts & {
  public?: boolean;
  tags?: string[];
};

export type RegisterWorkOpts = BaseOpts & {
  venue: string;
  key?: 'id' | 'doi';
  kind?: string;
  collection?: string;
  title?: string;
  cdn?: string;
  cdnKey?: string;
  draft?: boolean;
  metadata?: string;
  source?: string;
  new?: boolean;
  tags?: string[];
};

export type WorkPushLog = BaseLog & {
  work?: IdAndDate;
  workVersion?: IdAndDate;
  key?: string;
};
