import type { BlockId } from '../blocks/types';

import { projectIdToString, blockListToString, blockIdToString, title2name } from './id';
import type { ProjectId } from '../projects';

describe('Utils', () => {
  describe('ID title to name replaces accents', () => {
    expect(title2name('café')).toBe('cafe');
    expect(title2name('Crème Brulée')).toBe('creme-brulee');
    expect(title2name('àáâãäåçèéêëìíîïñòóôõöùúûüýÿ')).toBe('aaaaaaceeeeiiiinooooouuuuyy');
    expect(title2name('æœﬁ')).toBe('aeoefi');
    expect(title2name('ł')).toBe('l');
  });
  describe('URI mutators', () => {
    it('projectIdToString', () => {
      expect(projectIdToString('abcdef' as ProjectId)).toEqual('abcdef');
    });

    it('blockListToString', () => {
      expect(blockListToString('abcdef' as ProjectId)).toEqual('abcdef/blocks');
    });

    it('blockIdToString', () => {
      expect(blockIdToString({ project: 'a', block: 'b' } as BlockId)).toEqual('a/b');
    });
  });
});
