import { CheckStatus } from '@curvenote/check-definitions';
import type { CheckDefinition, CheckResult } from '@curvenote/check-definitions';
import type { ISession } from 'myst-cli';
import type { RuleId } from 'myst-common';
import type { CheckInterface } from './types.js';

/**
 * Add validation function to a CheckDefinition for MyST errors
 *
 * The validation function returns a failing CheckResult if a warning
 * with matching check.id exists in the redux store. If no matching warning
 * exists, the function returns nothing.
 */
export function checkStoreHasWarning(check: CheckDefinition): CheckInterface {
  const validate = async (session: ISession) => {
    const warnings = session.getAllWarnings(check.id as RuleId);
    return warnings.map((warning) => {
      const result: CheckResult = {
        status: CheckStatus.fail,
        message: warning.message,
        file: warning.file,
      };
      if (warning.position) {
        result.position = warning.position;
      }
      return result;
    });
  };
  return { ...check, validate };
}

type CheckResultOpts = Omit<CheckResult, 'status' | 'message'>;

export function pass(message: string, opts?: Omit<CheckResultOpts, 'cause'>): CheckResult {
  return { status: CheckStatus.pass, message, ...opts };
}

export function fail(message: string, opts?: CheckResultOpts): CheckResult {
  return { status: CheckStatus.fail, message, ...opts };
}

export function error(message: string, opts?: CheckResultOpts): CheckResult {
  return { status: CheckStatus.error, message, ...opts };
}
