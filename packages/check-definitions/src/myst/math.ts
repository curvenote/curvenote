import { RuleId } from 'myst-common';
import { withTags } from '../utils.js';
import { CheckTags } from '../types.js';

const checks = [
  {
    id: RuleId.mathLabelLifted,
    title: 'Math Label Lifted',
    purpose: 'Enumerated math label is identified and lifted from latex.',
  },
  {
    id: RuleId.mathEquationEnvRemoved,
    title: 'Math Equation Env Removed',
    purpose: 'Equation environment is removed from latex.',
  },
  {
    id: RuleId.mathEqnarrayReplaced,
    title: 'Eqnarray Replaced',
    purpose: 'Latex align environment should be used instead of eqnarray.',
  },
  {
    id: RuleId.mathAlignmentAdjusted,
    title: 'Math Alignment Adjusted',
    purpose: 'Math align environment renders correctly.',
  },
  {
    id: RuleId.mathRenders,
    title: 'Math Renders Successfully',
    purpose: 'Equation renders without any warning or errors.',
  },
];

export const mathRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.math],
});
