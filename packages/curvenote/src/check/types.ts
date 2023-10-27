import type { CheckDefinition } from '@curvenote/check-definitions';
import type { CheckResult, CheckStatus } from '@curvenote/check-implementations';

export type CompiledCheckResults = (CheckDefinition & CheckResult)[];

export type CheckReport = {
  status: CheckStatus;
  results: {
    category: string;
    status: CheckStatus;
    checks: CompiledCheckResults;
  }[];
};
