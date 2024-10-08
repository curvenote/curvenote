import { RuleId } from 'myst-common';
import { withTags } from '../utils.js';
import { CheckTags } from '../types.js';

const checks = [
  {
    id: RuleId.referenceTemplateFills,
    title: 'Reference Template Fills',
    purpose: 'Template for reference enumeration is valid and fills.',
  },
  {
    id: RuleId.identifierIsUnique,
    title: 'Unique Identifier',
    purpose: 'Identifiers are unique.',
  },
  {
    id: RuleId.referenceTargetResolves,
    title: 'Reference Target Resolves',
    purpose: 'Cross-reference target exists and resolves.',
  },
  {
    id: RuleId.referenceSyntaxValid,
    title: 'Valid Reference Syntax',
    purpose: 'Cross-reference syntax is valid.',
  },
  {
    id: RuleId.referenceTargetExplicit,
    title: 'Explicit Reference Target',
    purpose: 'Cross-reference target is explicitly specified.',
  },
  {
    id: RuleId.footnoteReferencesDefinition,
    title: 'Footnote References Definition',
    purpose: 'Footnote references correctly point to their definitions.',
  },
  {
    id: RuleId.intersphinxReferencesResolve,
    title: 'Intersphinx References Resolve',
    purpose: 'Intersphinx references successfully resolve.',
  },
];

export const referenceRuleChecks = withTags(checks, {
  tags: [CheckTags.build, CheckTags.reference],
});
