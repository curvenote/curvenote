import type { ZodError } from 'zod';

export function formatZodError(error?: ZodError) {
  return error
    ? error.issues
        .map((e) => `[${e.code}] ${e.path.join('/')} ${e.message.toLocaleLowerCase()}`)
        .join(', ')
    : 'Unknown Zod Error';
}
