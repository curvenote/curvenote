import { RuleId } from 'myst-common';
import { withTags } from '../utils.js';
import { CheckTags } from '../types.js';

const checks = [
  {
    id: RuleId.staticFileCopied,
    title: 'Static File Copied',
    purpose: 'Static site asset successfully copied.',
  },
  {
    id: RuleId.exportFileCopied,
    title: 'Export File Copied',
    purpose: 'Exported file is successfully copied.',
  },
  {
    id: RuleId.sourceFileCopied,
    title: 'Source File Copied',
    purpose: 'Source file for MyST site is successfully copied.',
  },
  {
    id: RuleId.templateFileCopied,
    title: 'Template File Copied',
    purpose: 'Supporting template file is successfully copied.',
  },
  {
    id: RuleId.staticActionFileCopied,
    title: 'Static Action File Copied',
    purpose: 'Static site action file is successfully copied.',
  },
];

export const staticRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.static],
});
