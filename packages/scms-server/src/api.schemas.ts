import type { ZodError, z } from 'zod';
import { httpError } from '@curvenote/scms-core';

/**
 * Validates data against a Zod schema and returns the parsed result.
 * Throws a Bad Request error if validation fails.
 *
 * @template U The Zod schema type extending AnyZodObject
 * @param {U} schema - The Zod schema to validate against
 * @param {any} data - The data to validate
 * @returns {z.infer<typeof schema>} The validated and parsed data
 * @throws {Error} Throws an HTTP 400 error with detailed validation issues if validation fails
 */
export function validate<U extends z.ZodObject<any>>(schema: U, data: any): z.infer<typeof schema> {
  try {
    return schema.parse(data) as z.infer<typeof schema>;
  } catch (error: any) {
    const statusText = (error as ZodError).issues.reduce((acc, issue) => {
      const { message, code, path, expected, received } = issue as any;
      let msg = `${message}[${code}](path: ${path.join('.')}`;
      if (expected) msg += `, expected: ${expected}`;
      if (received) msg += `, received: ${received}`;
      msg += ')';
      return acc.length > 0 ? `${acc}, ${msg}` : msg;
    }, '');
    throw httpError(400, statusText);
  }
}
