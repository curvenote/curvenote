// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it } from 'vitest';
import type { ValidationOptions } from 'simple-validators';
import { validateCheck, validateCheckDefinition } from './validators';
import { Session } from 'myst-cli';

let opts: ValidationOptions;
let session: Session;

beforeEach(() => {
  opts = { property: 'test', messages: {} };
  session = new Session();
});

describe('validateCheckDefinition', () => {
  it('valid check definition passes', async () => {
    const check = {
      id: 'my-check',
      title: 'Test Check',
      purpose: 'Just a test',
      tags: ['testing'],
      options: [
        {
          id: 'hasSomething',
          type: 'boolean',
        },
        {
          id: 'something',
          type: 'string',
          condition: {
            id: 'hasSomething',
            value: true,
          },
        },
      ],
    };
    expect(validateCheckDefinition(session, check, opts)).toBeTruthy();
    expect(opts.messages?.warnings?.length).toBeFalsy();
    expect(opts.messages?.errors?.length).toBeFalsy();
  });
  it('invalid condition id fails', async () => {
    const check = {
      id: 'my-check',
      title: 'Test Check',
      purpose: 'Just a test',
      tags: ['testing'],
      options: [
        {
          id: 'something',
          type: 'string',
          condition: {
            id: 'hasSomething',
            value: true,
          },
        },
      ],
    };
    validateCheckDefinition(session, check, opts);
    expect(opts.messages?.errors?.length).toEqual(1);
  });
});

describe('validateCheck', () => {
  it('valid check passes', async () => {
    const checkDef = {
      id: 'my-check',
      title: 'Test Check',
      purpose: 'Just a test',
      tags: ['testing'],
      options: [
        {
          id: 'hasSomething',
          type: 'boolean' as any,
        },
        {
          id: 'something',
          type: 'string' as any,
          required: true,
          condition: {
            id: 'hasSomething',
            value: true,
          },
        },
      ],
    };
    const check = {
      id: 'my-check',
      hasSomething: true,
      something: 'Option!',
    };
    expect(validateCheck(session, check, [checkDef], opts)).toBeTruthy();
    expect(opts.messages?.warnings?.length).toBeFalsy();
    expect(opts.messages?.errors?.length).toBeFalsy();
  });
  it('unknown id fails', async () => {
    const check = {
      id: 'my-check',
    };
    validateCheck(session, check, [], opts);
    expect(opts.messages?.errors?.length).toEqual(1);
  });
  it('invalid check options fail', async () => {
    const checkDef = {
      id: 'my-check',
      title: 'Test Check',
      purpose: 'Just a test',
      tags: ['testing'],
      options: [
        {
          id: 'hasSomething',
          type: 'boolean' as any,
        },
        {
          id: 'something',
          type: 'string' as any,
          required: true,
          condition: {
            id: 'hasSomething',
            value: true,
          },
        },
      ],
    };
    const check = {
      id: 'my-check',
      hasSomething: true,
    };
    validateCheck(session, check, [checkDef], opts);
    expect(opts.messages?.errors?.length).toEqual(1);
  });
});
