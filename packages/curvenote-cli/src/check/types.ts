import type { CheckDefinition, CheckResult, CheckStatus } from '@curvenote/check-definitions';

export type CompiledCheckResults = (CheckDefinition & CheckResult)[];

export type CheckReport = {
  status: CheckStatus;
  results: {
    category: string;
    status: CheckStatus;
    checks: CompiledCheckResults;
  }[];
};
