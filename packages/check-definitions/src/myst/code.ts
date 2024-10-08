import { RuleId } from 'myst-common';
import { CheckTags } from '../types.js';
import { withTags } from '../utils.js';

const checks = [
  {
    id: RuleId.codeMetadataLifted,
    title: 'Code metadata lifted',
    purpose:
      'Metadata defined on code is lifted to blocks; often failures are associated with multiple code metadata definitions within one block.',
  },
  {
    id: RuleId.codeMetatagsValid,
    title: 'Code metatags valid',
    purpose:
      'Tags in code metadata must be a list of strings, and they must not conflict with each other.',
  },
  {
    id: RuleId.codeLangDefined,
    title: 'Code lang defined',
    purpose: 'Code blocks should define their language',
  },
  {
    id: RuleId.codeMetadataLoads,
    title: 'Code metadata loads',
    purpose: 'Code metadata must be valid yaml.',
  },
  {
    id: RuleId.inlineExpressionRenders,
    title: 'Inline expression renders',
    purpose: 'Inline expression must be a recognized mime bundle.',
  },
];

export const codeRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.code],
});
