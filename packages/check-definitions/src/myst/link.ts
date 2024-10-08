import { RuleId } from 'myst-common';
import { withTags } from '../utils.js';
import { CheckTags } from '../types.js';

const checks = [
  {
    id: RuleId.mystLinkValid,
    title: 'Valid MyST Link',
    purpose: 'Myst link to local or intersphinx content is valid.',
  },
  {
    id: RuleId.rridLinkValid,
    title: 'Valid RRID Link',
    purpose: 'The RRID link matches expected pattern.',
  },
  {
    id: RuleId.wikipediaLinkValid,
    title: 'Valid Wikipedia Link',
    purpose: 'Wikipedia link matches expected pattern.',
  },
  {
    id: RuleId.doiLinkValid,
    title: 'Valid DOI Link',
    purpose: 'DOI link is a valid DOI.',
  },
  {
    id: RuleId.linkResolves,
    title: 'Link Resolves',
    purpose: 'Link can be successfully fetched.',
  },
];

export const linkRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.link],
});
