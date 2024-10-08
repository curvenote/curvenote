import type { Check, CheckDefinition, CheckResult } from '@curvenote/check-definitions';
import type { ISession } from 'myst-cli';

export type CheckInterface = CheckDefinition & {
  validate: (
    session: ISession,
    options: Check,
  ) => Promise<CheckResult | CheckResult[]> | CheckResult | CheckResult[];
};
