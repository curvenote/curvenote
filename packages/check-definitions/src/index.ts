import { mystRuleChecks } from './myst/index.js';
import { submissionRuleChecks } from './submission.js';
import type { CheckDefinition } from './types.js';

export { mystRuleChecks, submissionRuleChecks };
export const checks = [...mystRuleChecks, ...submissionRuleChecks];
export * from './types.js';

export function getCheckDefinition(checkId: string): CheckDefinition {
  const check = checks.find(({ id }) => id === checkId);
  if (!check) throw new Error(`Check ID "${checkId}" was not found in known definitions.`);
  return check;
}
