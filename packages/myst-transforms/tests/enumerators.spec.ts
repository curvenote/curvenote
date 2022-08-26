import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { Root } from 'mdast';
import { enumerateTargetsTransform, ReferenceState } from '../src';

type TestFile = {
  cases: TestCase[];
};
type TestCase = {
  title: string;
  before: Root;
  after: Root;
  opts?: Record<string, boolean>;
};

const fixtures = path.join('tests', 'enumerators.yml');

const testYaml = fs.readFileSync(fixtures).toString();
const cases = (yaml.load(testYaml) as TestFile).cases;

describe('enumerateTargets', () => {
  test.each(cases.map((c): [string, TestCase] => [c.title, c]))(
    '%s',
    (_, { before, after, opts }) => {
      const state = new ReferenceState(opts);
      const transformed = enumerateTargetsTransform(before as Root, { state });
      expect(yaml.dump(transformed)).toEqual(yaml.dump(after));
    },
  );
});
