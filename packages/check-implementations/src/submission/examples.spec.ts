// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it } from 'vitest';
import type { ValidationOptions } from 'simple-validators';
import { Session } from 'myst-cli';
import { validateCheckDefinition } from '../validators.js';
import { abstractExists, abstractLength } from './abstract.js';
import { dataAvailabilityExists } from './data-availability.js';
import { linksResolve } from './links.js';

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

describe('abstractLength', () => {
  it('abstractLength is valid check', async () => {
    expect(validateCheckDefinition(session, abstractLength, opts)).toBeTruthy();
    expect(opts.messages?.warnings?.length).toBeFalsy();
    expect(opts.messages?.errors?.length).toBeFalsy();
  });
});

describe('availabilityExists', () => {
  it('availabilityExists is valid check', async () => {
    expect(validateCheckDefinition(session, dataAvailabilityExists, opts)).toBeTruthy();
    expect(opts.messages?.warnings?.length).toBeFalsy();
    expect(opts.messages?.errors?.length).toBeFalsy();
  });
});

describe('linksResolve', () => {
  it('linksResolve is valid check', async () => {
    expect(validateCheckDefinition(session, linksResolve, opts)).toBeTruthy();
    expect(opts.messages?.warnings?.length).toBeFalsy();
    expect(opts.messages?.errors?.length).toBeFalsy();
  });
});
