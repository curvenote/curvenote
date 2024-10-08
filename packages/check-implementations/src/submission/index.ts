export * from './abstract.js';
export * from './authors.js';
export * from './data-availability.js';
export * from './figure-count.js';
export * from './keywords.js';
export * from './links.js';
export * from './word-count.js';
import { abstractRules } from './abstract.js';
import { authorRules } from './authors.js';
import { dataAvailabilityRules } from './data-availability.js';
import { doiCheckRules } from './doi.js';
import { figureCountRules } from './figure-count.js';
import { keywordsRules } from './keywords.js';
import { linksRules } from './links.js';
import { wordCountRules } from './word-count.js';

export const submissionRuleChecks = [
  ...abstractRules,
  ...authorRules,
  ...dataAvailabilityRules,
  ...keywordsRules,
  ...linksRules,
  ...doiCheckRules,
  ...wordCountRules,
  ...figureCountRules,
];
