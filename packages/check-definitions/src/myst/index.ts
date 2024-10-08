import { blockRuleChecks } from './block.js';
import { citationRuleChecks } from './citation.js';
import { codeRuleChecks } from './code.js';
import { directiveRuleChecks } from './directive.js';
import { exportRuleChecks } from './export.js';
import { frontmatterRuleChecks } from './frontmatter.js';
import { glossaryRuleChecks } from './glossary.js';
import { imageRuleChecks } from './image.js';
import { includeRuleChecks } from './include.js';
import { linkRuleChecks } from './link.js';
import { mathRuleChecks } from './math.js';
import { notebookRuleChecks } from './notebook.js';
import { parseRuleChecks } from './parse.js';
import { referenceRuleChecks } from './reference.js';
import { roleRuleChecks } from './role.js';
import { staticRuleChecks } from './static.js';
import { tocRuleChecks } from './toc.js';

export const mystRuleChecks = [
  ...blockRuleChecks,
  ...citationRuleChecks,
  ...codeRuleChecks,
  ...directiveRuleChecks,
  ...exportRuleChecks,
  ...frontmatterRuleChecks,
  ...glossaryRuleChecks,
  ...imageRuleChecks,
  ...includeRuleChecks,
  ...linkRuleChecks,
  ...mathRuleChecks,
  ...notebookRuleChecks,
  ...parseRuleChecks,
  ...referenceRuleChecks,
  ...roleRuleChecks,
  ...staticRuleChecks,
  ...tocRuleChecks,
];
