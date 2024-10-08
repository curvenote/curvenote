import { mystRuleChecks as checks } from '@curvenote/check-definitions';
import { checkStoreHasWarning } from './utils.js';

export const mystRuleChecks = checks.map((check) => {
  return checkStoreHasWarning(check);
});
