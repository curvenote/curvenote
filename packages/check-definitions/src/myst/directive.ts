import { RuleId } from 'myst-common';
import { CheckTags } from '../types.js';
import { withTags } from '../utils.js';

const checks = [
  {
    id: RuleId.directiveKnown,
    title: 'Known Directive',
    purpose: 'Check if directive is recognized.',
  },
  {
    id: RuleId.directiveArgumentCorrect,
    title: 'Directive Argument Validates',
    purpose: 'Argument is valid, according to the rules of the specific directive.',
  },
  {
    id: RuleId.directiveOptionsCorrect,
    title: 'Directive Options Validate',
    purpose: 'Options are valid, according to the rules of the specific directive.',
  },
  {
    id: RuleId.directiveBodyCorrect,
    title: 'Directive Body Validates',
    purpose: 'Body is valid, according to the rules of the specific directive.',
  },
  {
    id: RuleId.gatedNodesJoin,
    title: 'Gated Nodes Join',
    purpose: 'Gated nodes are successfully joined.',
  },
];

export const directiveRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.directive],
});
