import { RuleId } from 'myst-common';
import { withTags } from '../utils.js';
import { CheckTags } from '../types.js';

const checks = [
  {
    id: RuleId.tocContentsExist,
    title: 'TOC Contents Exist',
    purpose: 'The table of contents points to existing files.',
  },
  {
    id: RuleId.validTOCStructure,
    title: 'Valid TOC Structure',
    purpose: 'The table of contents has a valid basic structure.',
  },
  {
    id: RuleId.validTOC,
    title: 'Valid TOC',
    purpose: 'The table of contents is able to load.',
  },
];

export const tocRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.toc],
});
