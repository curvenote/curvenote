import {
  crossValidateConditions,
  makeValidateOptionsFunction,
  validateTemplateOptionDefinition,
} from 'myst-templates';
import type { ValidationOptions } from 'simple-validators';
import {
  defined,
  incrementOptions,
  validateKeys,
  validateList,
  validateObject,
  validateObjectKeys,
  validateString,
  validationError,
} from 'simple-validators';
import type { Check, CheckDefinition } from '@curvenote/check-definitions';
import type { ISession } from 'myst-templates';

/**
 * Validation function to test Check definitions
 *
 * Checks must be defined in code (as opposed to declaratively) since they also include
 * a validation function. That means this validator is probably most useful in code unit tests
 * to ensure that the Check interface is valid, beyond the basic typescript checks.
 */
export function validateCheckDefinition(session: ISession, input: any, opts: ValidationOptions) {
  const inputObj = validateObject(input, opts);
  if (inputObj === undefined) return undefined;
  const value = validateObjectKeys(
    inputObj,
    {
      required: ['id', 'title', 'purpose', 'tags'],
      optional: ['options', 'validate'],
    },
    opts,
  );
  if (value === undefined) return undefined;
  const id = validateString(value.id, incrementOptions('id', opts));
  const title = validateString(value.title, incrementOptions('title', opts));
  const purpose = validateString(value.purpose, incrementOptions('purpose', opts));
  const tags =
    validateList(value.tags, incrementOptions('tags', opts), (val, ind) => {
      return validateString(val, incrementOptions(`tags.${ind}`, opts));
    }) ?? [];
  if (id === undefined || title === undefined || purpose === undefined || tags === undefined) {
    return undefined;
  }
  const output: CheckDefinition = { id, title, purpose, tags };
  if (defined(value.options)) {
    output.options = validateList(value.options, incrementOptions('options', opts), (val, ind) => {
      return validateTemplateOptionDefinition(
        session,
        val,
        incrementOptions(`options.${ind}`, opts),
      );
    });
  }
  crossValidateConditions(session, output.options || [], [], [], opts);
  return output;
}

export const validateCheckOptions = makeValidateOptionsFunction(['id']);

/**
 * Validation function to test if Check is known and provides valid options
 */
export function validateCheck(
  session: ISession,
  input: any,
  checkDefinitions: CheckDefinition[],
  opts: ValidationOptions,
) {
  const inputObj = validateObject(input, opts);
  if (inputObj === undefined) return undefined;
  validateKeys(inputObj, { required: ['id'] }, { ...opts, suppressWarnings: true });
  const idOpts = incrementOptions('id', opts);
  const id = validateString(inputObj.id, idOpts);
  if (!id) return validationError(`check does not have an ID: ${id}`, idOpts);
  const checkDefinition = checkDefinitions.find((def) => def.id === id);
  if (!checkDefinition) return validationError(`unknown check ID: ${id}`, idOpts);
  const output: Check = {
    ...validateCheckOptions(session, inputObj, checkDefinition?.options ?? [], opts),
    id,
  };
  return output;
}
