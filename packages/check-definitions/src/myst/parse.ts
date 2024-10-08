import { RuleId } from 'myst-common';
import { withTags } from '../utils.js';
import { CheckTags } from '../types.js';

const checks = [
  {
    id: RuleId.texParses,
    title: 'TeX Parses',
    purpose: 'TeX source file parses to MyST',
  },
  {
    id: RuleId.jatsParses,
    title: 'JATS Parses',
    purpose: 'JATS source file parses to MyST',
  },
  {
    id: RuleId.mystFileLoads,
    title: 'MyST File Loads',
    purpose: 'MyST markdown/notebook file parses to MyST',
  },
];

export const parseRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.parse],
});
