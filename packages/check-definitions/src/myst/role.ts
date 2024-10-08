import { RuleId } from 'myst-common';
import { withTags } from '../utils.js';
import { CheckTags } from '../types.js';

const checks = [
  {
    id: RuleId.roleKnown,
    title: 'Known Role',
    purpose: 'Check if role is recognized.',
  },
  {
    id: RuleId.roleBodyCorrect,
    title: 'Role Body Validates',
    purpose: 'Body is valid, according to the rules of the specific role.',
  },
];

export const roleRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.role],
});
