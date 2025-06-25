import type { BaseLog, IdAndDate } from '../logs/types.js';

export type WorkPushLog = BaseLog & {
  work?: IdAndDate;
  workVersion?: IdAndDate;
  key?: string;
};
