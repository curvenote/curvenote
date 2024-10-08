import { RuleId } from 'myst-common';
import { withTags } from '../utils.js';
import { CheckTags } from '../types.js';

const checks = [
  {
    id: RuleId.notebookAttachmentsResolve,
    title: 'Notebook Attachments Resolve',
    purpose: 'Notebook attachments successfully load.',
  },
  {
    id: RuleId.notebookOutputCopied,
    title: 'Notebook Output Copied',
    purpose: 'Notebook output is copied to separate file.',
  },
];

export const notebookRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.notebook],
});
