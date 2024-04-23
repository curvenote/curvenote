import { describe, expect, test } from 'vitest';
import { exec as execWithCb } from 'child_process';
import util from 'util';

const exec = util.promisify(execWithCb);

describe('CLI Smoke Tests', () => {
  test(
    'curvenote -v',
    async () => {
      expect.assertions(0);
      try {
        const { stdout } = await exec('curvenote -v');
        console.log(stdout);
      } catch (error) {
        console.error(error);
        expect(error).not.toBeNull();
      }
    },
    { timeout: 15000 },
  );
});
