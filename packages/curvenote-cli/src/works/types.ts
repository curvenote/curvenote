import type { BaseLog, IdAndDate, BaseOpts } from '../logs/types.js';

export type PushOpts = BaseOpts & {
  public?: boolean;
};

export type RegisterWorkOpts = BaseOpts & {
  venue: string;
  kind?: string;
  collection?: string;
  key?: string;
  title?: string;
  draft?: boolean;
  metadata?: string;
  source?: string;
  new?: boolean;
};

export type WorkPushLog = BaseLog & {
  work?: IdAndDate;
  workVersion?: IdAndDate;
  key?: string;
};
