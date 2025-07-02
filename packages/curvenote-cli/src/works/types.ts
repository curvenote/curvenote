import type { BaseLog, IdAndDate, BaseOpts } from '../logs/types.js';

export type PushOpts = BaseOpts & {
  public?: boolean;
};

export type WorkPushLog = BaseLog & {
  work?: IdAndDate;
  workVersion?: IdAndDate;
  key?: string;
};
