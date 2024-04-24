import { describe, test, expect, vi } from 'vitest';
import { validateStringOptions } from './utils';

describe('utils', () => {
  test('validateStringOptions - invalid', () => {
    const vfile = { message: vi.fn() };
    validateStringOptions(vfile as any, 'fieldName', 'field', ['notfield']);
    expect(vfile.message.mock.calls.length).toBe(1);
  });
  test('validateStringOptions - valid', () => {
    const vfile = { message: vi.fn() };
    validateStringOptions(vfile as any, 'fieldName', 'field', ['field', 'notfield']);
    expect(vfile.message.mock.calls.length).toBe(0);
  });
});
