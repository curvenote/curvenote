import { RuleId } from 'myst-common';
import { CheckTags } from '../types.js';
import { withTags } from '../utils.js';

const checks = [
  {
    id: RuleId.citationIsUnique,
    title: 'Citation is unique',
    purpose: 'Citation does not have any duplicate identifiers in the MyST project.',
  },
  {
    id: RuleId.bibFileExists,
    title: 'Bib file exists',
    purpose: 'Bib file referenced in config file exists in the MyST project.',
  },
];

export const citationRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.citation],
});
