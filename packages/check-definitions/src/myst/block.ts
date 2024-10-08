import { RuleId } from 'myst-common';
import { CheckTags } from '../types.js';
import { withTags } from '../utils.js';

const checks = [
  {
    id: RuleId.blockMetadataLoads,
    title: 'Block Metadata Loads',
    purpose: 'Block metadata is loaded successfully.',
  },
];

export const blockRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.block],
});
