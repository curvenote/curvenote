import { RuleId } from 'myst-common';
import { CheckTags } from '../types.js';
import { withTags } from '../utils.js';

const checks = [
  {
    id: RuleId.glossaryUsesDefinitionList,
    title: 'Glossary Uses Definition List',
    purpose: 'Glossary contains terms as a definition list.',
  },
];

export const glossaryRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.glossary],
});
