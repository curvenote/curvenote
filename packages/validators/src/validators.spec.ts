import type { ValidationOptions } from './types';
import {
  fillMissingKeys,
  filterKeys,
  incrementOptions,
  locationSuffix,
  validateBoolean,
  validateDate,
  validateEmail,
  validateEnum,
  validateKeys,
  validateList,
  validateNumber,
  validateObject,
  validateString,
  validateSubdomain,
  validateUrl,
} from './validators';

export enum ExampleEnum {
  'initializing' = 'initializing',
  'completed' = 'completed',
  'failed' = 'failed',
}

let opts: ValidationOptions;

beforeEach(() => {
  opts = { property: 'test', messages: {} };
});

describe('locationSuffix', () => {
  it('empty opts return empty string', async () => {
    expect(locationSuffix(opts)).toEqual('');
  });
  it('file opts return file', async () => {
    expect(locationSuffix({ ...opts, file: 'file.ts' })).toEqual(' (at file.ts)');
  });
  it('location opts return location', async () => {
    expect(locationSuffix({ ...opts, location: 'loc' })).toEqual(' (at loc)');
  });
  it('file/location opts return file/location', async () => {
    expect(locationSuffix({ ...opts, file: 'file.ts', location: 'loc' })).toEqual(
      ' (at file.ts#loc)',
    );
  });
});

describe('incrementOptions', () => {
  it('property sets location', async () => {
    expect(incrementOptions('new', opts)).toEqual({ ...opts, property: 'new', location: 'test' });
  });
  it('property updates location', async () => {
    expect(incrementOptions('new', { ...opts, location: 'object' })).toEqual({
      ...opts,
      property: 'new',
      location: 'object.test',
    });
  });
  it('errors/warnings are not lost', async () => {
    const newOpts = incrementOptions('new', opts);
    if (newOpts.messages) {
      newOpts.messages.errors = [{ property: 'a', message: 'x' }];
      newOpts.messages.warnings = [
        { property: 'b', message: 'y' },
        { property: 'c', message: 'z' },
      ];
    }
    expect(opts.messages).toEqual({
      errors: [{ property: 'a', message: 'x' }],
      warnings: [
        { property: 'b', message: 'y' },
        { property: 'c', message: 'z' },
      ],
    });
  });
});

describe('validateBoolean', () => {
  it('true returns self', async () => {
    expect(validateBoolean(true, opts)).toEqual(true);
  });
  it('false returns self', async () => {
    expect(validateBoolean(false, opts)).toEqual(false);
  });
  it('"true" returns true', async () => {
    expect(validateBoolean('true', opts)).toEqual(true);
  });
  it('"False" returns false', async () => {
    expect(validateBoolean('False', opts)).toEqual(false);
  });
  it('invalid type errors', async () => {
    expect(validateBoolean(0, opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('invalid string errors', async () => {
    expect(validateBoolean('t', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
});

describe('validateNumber', () => {
  it('number returns self', async () => {
    expect(validateNumber(2.2, opts)).toEqual(2.2);
  });
  it('string number returns number', async () => {
    expect(validateNumber('2.2', opts)).toEqual(2.2);
  });
  it('invalid string errors', async () => {
    expect(validateNumber('two', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('less than min errors', async () => {
    expect(validateNumber(0, { min: 5, ...opts })).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('greater than max errors', async () => {
    expect(validateNumber(0, { max: -1, ...opts })).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('non-integer errors', async () => {
    expect(validateNumber(2.2, { integer: true, ...opts })).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('integer in bounds returns self', async () => {
    expect(validateNumber(5, { integer: true, min: 4, max: 5, ...opts })).toEqual(5);
  });
});

describe('validateString', () => {
  it('valid value returns self', async () => {
    expect(validateString('a', opts)).toEqual('a');
  });
  it('invalid type errors', async () => {
    expect(validateString({}, opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('exceeding maxLenth errors', async () => {
    expect(validateString('abc', { maxLength: 1, ...opts })).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('regex match returns self', async () => {
    expect(validateString('abc', { regex: '^[a-c]{3}$', ...opts })).toEqual('abc');
  });
  it('incompatible regex errors', async () => {
    expect(validateString('abc', { regex: '^[a-c]{2}$', ...opts })).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('escape function runs', async () => {
    expect(validateString('abc', { maxLength: 3, escapeFn: (s) => `${s}${s}`, ...opts })).toEqual(
      'abcabc',
    );
  });
});

describe('validateUrl', () => {
  it('valid value returns self', async () => {
    expect(validateUrl('https://example.com', opts)).toEqual('https://example.com');
  });
  it('invalid string errors', async () => {
    expect(validateUrl('not a url', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('path only errors', async () => {
    expect(validateUrl('public/default', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('valid value includes', async () => {
    expect(validateUrl('https://example.com', { ...opts, includes: 'le.c' })).toEqual(
      'https://example.com',
    );
  });
  it('valid value without includes errors', async () => {
    expect(validateUrl('https://example.com', { ...opts, includes: 'example.org' })).toEqual(
      undefined,
    );
    expect(opts.messages.errors?.length).toEqual(1);
  });
});

describe('validateSubdomain', () => {
  it('valid value returns self', async () => {
    expect(validateSubdomain('www.example.com', opts)).toEqual('www.example.com');
  });
  it('valid uppercase is lowercased', async () => {
    expect(validateSubdomain('www.EXAMPLE.com', opts)).toEqual('www.example.com');
  });
  it('valid value removes protocol', async () => {
    expect(validateSubdomain('https://www.example.com', opts)).toEqual('www.example.com');
  });
  it('invalid url errors', async () => {
    expect(validateSubdomain('not a url', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('invalid protocol errors', async () => {
    expect(validateSubdomain('ftp://www.example.com', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('top-level domain errors', async () => {
    expect(validateSubdomain('example.com', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('value with path errors', async () => {
    expect(validateSubdomain('www.example.com/path', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('value with query errors', async () => {
    expect(validateSubdomain('www.example.com?query=true', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('value with fragment errors', async () => {
    expect(validateSubdomain('www.example.com#fragment', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
});

describe('validateEmail', () => {
  it('valid email returns self', async () => {
    expect(validateEmail('example@example.com', opts)).toEqual('example@example.com');
  });
  it('invalid email errors', async () => {
    expect(validateEmail('https://example.com', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
});

describe('validateEnum', () => {
  it('valid enum value returns self', async () => {
    expect(validateEnum<ExampleEnum>('completed', { ...opts, enum: ExampleEnum })).toEqual(
      'completed',
    );
  });
  it('invalid enum value errors', async () => {
    expect(validateEnum<ExampleEnum>('invalid', { ...opts, enum: ExampleEnum })).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
});

describe('validateDate', () => {
  it.each([
    '2021-12-14T10:43:51.777Z',
    '14 Dec 2021',
    '14 December 2021',
    '2021, December 14',
    '2021 December 14',
    '12/14/2021',
    '12-14-2021',
    '2022/12/14',
    '2022-12-14',
  ])('valid date: %p', async (date: any) => {
    expect(validateDate(date, opts)).toEqual(date);
  });
  it('date object is valid', async () => {
    const date = new Date();
    expect(validateDate(date, opts)).toEqual(date.toISOString());
  });
  it('invalid date errors', async () => {
    expect(validateDate('https://example.com', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
});

describe('validateObject', () => {
  it('valid value returns self', async () => {
    expect(validateObject({ a: 1 }, opts)).toEqual({ a: 1 });
  });
  it('invalid type errors', async () => {
    expect(validateObject('a', opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
});

describe('validateKeys', () => {
  it('empty value', async () => {
    expect(validateKeys({}, {}, opts)).toEqual({});
  });
  it('required keys', async () => {
    expect(validateKeys({ a: 1, b: 2 }, { required: ['a', 'b'] }, opts)).toEqual({ a: 1, b: 2 });
  });
  it('optional keys', async () => {
    expect(validateKeys({ a: 1, b: 2 }, { optional: ['a', 'b'] }, opts)).toEqual({ a: 1, b: 2 });
  });
  it('extra keys filtered', async () => {
    expect(validateKeys({ a: 1, b: 2, c: 3 }, { required: ['a'], optional: ['b'] }, opts)).toEqual({
      a: 1,
      b: 2,
    });
    expect(opts.messages.warnings?.length).toEqual(1);
  });
  it('missing required keys errors', async () => {
    expect(validateKeys({ a: 1 }, { required: ['a', 'b'] }, opts)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
});

describe('validateList', () => {
  it('empty list', async () => {
    expect(validateList([], opts, (val) => val)).toEqual([]);
  });
  it('simple list and index', async () => {
    expect(validateList(['a', 'b', 'c'], opts, (val, ind) => `${val} ${ind}`)).toEqual([
      'a 0',
      'b 1',
      'c 2',
    ]);
  });
  it('list filters undefined values', async () => {
    expect(validateList(['a', 'b', 'c'], opts, (val) => (val === 'c' ? undefined : val))).toEqual([
      'a',
      'b',
    ]);
  });
  it('invalid object errors', async () => {
    expect(validateList({}, opts, (val) => val)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
  it('invalid string errors', async () => {
    expect(validateList('abc', opts, (val) => val)).toEqual(undefined);
    expect(opts.messages.errors?.length).toEqual(1);
  });
});

describe('fillMissingKeys', () => {
  it('primary supersedes secondary', async () => {
    expect(fillMissingKeys({ a: 1 }, { a: 2 }, ['a'])).toEqual({ a: 1 });
  });
  it('secondary supersedes nothing', async () => {
    expect(fillMissingKeys({}, { a: 2 }, ['a'])).toEqual({ a: 2 });
  });
  it('other filler keys ignored', async () => {
    expect(fillMissingKeys({ a: 1, b: 2 }, { a: 2, c: 3, d: 4 }, ['a', 'd'])).toEqual({
      a: 1,
      b: 2,
      d: 4,
    });
  });
});

describe('filterKeys', () => {
  it('remove existing key', async () => {
    expect(filterKeys({ a: 1, b: 2 }, ['a'])).toEqual({ a: 1 });
  });
  it('remove null', async () => {
    expect(filterKeys({ a: null }, ['a', 'b'])).toEqual({});
  });
});
