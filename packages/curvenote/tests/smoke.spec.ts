import { describe, expect, test } from 'vitest';
import { exec as execWithCb } from 'child_process';
import util from 'util';

const exec = util.promisify(execWithCb);

describe('CLI Smoke Tests', () => {
  test('an example site', async () => {
    expect.assertions(0);
    try {
      const { stdout } = await exec('curvenote build', { cwd: 'tests/example' });
      console.log(stdout);
    } catch (error) {
      console.error(error);
      expect(error).not.toBeNull();
    }
  });
});
