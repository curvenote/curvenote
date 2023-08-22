import { beforeEach, describe, expect, it } from 'vitest';
import type { ValidationOptions } from 'simple-validators';
import { Session } from '../..';
import { validateCheckDefinition } from '..';
import { abstractExists } from './abstractExists.js';

let opts: ValidationOptions;
let session: Session;

beforeEach(() => {
  opts = { property: 'test', messages: {} };
  session = new Session();
});

describe('abstractExists', () => {
  it('abstractExists is valid check', async () => {
    expect(validateCheckDefinition(session, abstractExists, opts)).toBeTruthy();
    expect(opts.messages?.warnings?.length).toBeFalsy();
    expect(opts.messages?.errors?.length).toBeFalsy();
  });
});
