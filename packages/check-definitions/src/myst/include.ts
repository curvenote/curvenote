import { RuleId } from 'myst-common';
import { CheckTags } from '../types.js';
import { withTags } from '../utils.js';

const checks = [
  {
    id: RuleId.mdastSnippetImports,
    title: 'MDAST Snippet Imports',
    purpose: 'MDAST snippet imports are resolved and loaded.',
  },
  {
    id: RuleId.includeContentFilters,
    title: 'Include Content Filters',
    purpose: 'Line number filters apply to include content successfully.',
  },
  {
    id: RuleId.includeContentLoads,
    title: 'Include Content Loads',
    purpose: 'Include content resolves and loads.',
  },
];

export const includeRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.include],
});
