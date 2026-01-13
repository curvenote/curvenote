/* eslint-disable import/no-named-as-default-member */
import type { ZodError, ZodIssue, z } from 'zod';
import { data as dataResponse } from 'react-router';
import type { FormError } from '@curvenote/scms-core';

/**
 * Validates form data against a Zod schema and executes a callback with the validated payload.
 * Returns either the callback result (success) or an error response with validation details.
 *
 * This function is React Router 7 friendly - it preserves return types for proper type inference.
 *
 * @template T The validated payload type from the schema
 * @template R The return type of the callback function
 * @param schema The Zod schema to validate against
 * @param formData The form data to validate
 * @param fn The callback function to execute with validated data
 * @param opts Optional configuration including additional error fields
 * @returns A promise resolving to either the callback result or an error response
 */
export async function withValidFormData<T, R>(
  schema: z.ZodType<T>,
  formData: unknown,
  fn: (payload: T) => Promise<R>,
  opts: {
    errorFields?: Record<string, any>;
  } = {},
): Promise<R | ReturnType<typeof dataResponse<{ error: FormError }>>> {
  try {
    const payload = validateFormData(schema, formData);
    const result = await fn(payload);
    return result;
  } catch (error: any) {
    return dataResponse(
      {
        error: {
          ...opts?.errorFields,
          message: error.message ?? 'Invalid form data',
          details: { issues: error.issues },
        },
      },
      { status: 400 },
    );
  }
}

/**
 * Validates data against a Zod schema and returns the parsed result.
 * Throws an error with parsed zod validations info
 *
 * @template T The output type of the schema validation
 * @param {z.ZodType<T>} schema - The Zod schema to validate against
 * @param {unknown} data - The data to validate
 * @returns {T} The validated and parsed data
 * @throws {Error} Throws an HTTP 400 error with detailed validation issues if validation fails
 */
export function validateFormData<T>(schema: z.ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data) as T;
  } catch (error: any) {
    const statusText = summarizeZodIssues((error as ZodError).issues);
    throw {
      message: statusText,
      error: 'Invalid form data',
      issues: error.issues,
    };
  }
}

export function summarizeZodIssues(issues: ZodIssue[]) {
  return issues.reduce((acc, issue) => {
    const { message, path } = issue as any;
    const msg = `[${path}]: ${message}`;
    return acc.length > 0 ? `${acc}, ${msg}` : msg;
  }, '');
}
