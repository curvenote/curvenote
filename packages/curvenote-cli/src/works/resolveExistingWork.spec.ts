import { beforeEach, describe, expect, it, vi } from 'vitest';
import inquirer from 'inquirer';
import { resolveExistingWork } from './resolveExistingWork.js';
import * as workUtils from './utils.js';

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('./utils.js', () => ({
  getWorkFromKey: vi.fn(),
  getWorksFromDoi: vi.fn(),
  workKeyExists: vi.fn(),
}));

describe('resolveExistingWork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns work by id lookup mode', async () => {
    const expected = { id: 'w1' } as any;
    vi.mocked(workUtils.getWorkFromKey).mockResolvedValueOnce(expected);
    const result = await resolveExistingWork({} as any, {
      mode: 'id',
      key: 'project-id',
      contextLabel: 'submit',
    });
    expect(result).toEqual(expected);
  });

  it('throws when doi mode has no doi in config', async () => {
    await expect(
      resolveExistingWork({} as any, {
        mode: 'doi',
        contextLabel: 'register',
      }),
    ).rejects.toThrow(/requires a non-empty doi/);
    await expect(
      resolveExistingWork({} as any, {
        mode: 'doi',
        doi: '   ',
        contextLabel: 'submit',
      }),
    ).rejects.toThrow(/requires a non-empty doi/);
  });

  it('returns undefined for doi mode with no matches', async () => {
    vi.mocked(workUtils.getWorksFromDoi).mockResolvedValueOnce([]);
    const result = await resolveExistingWork({} as any, {
      mode: 'doi',
      doi: '10.1000/test',
      contextLabel: 'register',
    });
    expect(result).toBeUndefined();
  });

  it('auto-selects latest match when yes=true', async () => {
    const expected = { id: 'w1' } as any;
    vi.mocked(workUtils.getWorksFromDoi).mockResolvedValueOnce([expected, { id: 'w2' } as any]);
    const result = await resolveExistingWork({} as any, {
      mode: 'doi',
      doi: '10.1000/test',
      yes: true,
      contextLabel: 'register',
    });
    expect(result).toEqual(expected);
  });

  it('prompts for specific work when multiple DOI matches', async () => {
    const works = [{ id: 'w1' }, { id: 'w2' }] as any[];
    vi.mocked(workUtils.getWorksFromDoi).mockResolvedValueOnce(works as any);
    vi.mocked(inquirer.prompt as any).mockResolvedValueOnce({ workId: 'w2' });
    const result = await resolveExistingWork({} as any, {
      mode: 'doi',
      doi: '10.1000/test',
      contextLabel: 'register',
    });
    expect(result).toEqual(works[1]);
  });

  it('returns undefined when single DOI match is rejected', async () => {
    vi.mocked(workUtils.getWorksFromDoi).mockResolvedValueOnce([{ id: 'w1' } as any]);
    vi.mocked(inquirer.prompt as any).mockResolvedValueOnce({ confirm: false });
    const result = await resolveExistingWork({} as any, {
      mode: 'doi',
      doi: '10.1000/test',
      contextLabel: 'register',
    });
    expect(result).toBeUndefined();
  });

  it('throws on DOI mode when fallback key collides', async () => {
    vi.mocked(workUtils.getWorksFromDoi).mockResolvedValueOnce([]);
    vi.mocked(workUtils.getWorkFromKey).mockResolvedValueOnce(undefined);
    vi.mocked(workUtils.workKeyExists as any).mockResolvedValueOnce(true);
    await expect(
      resolveExistingWork({} as any, {
        mode: 'doi',
        doi: '10.1000/test',
        fallbackCreateKey: 'existing-project-id',
        contextLabel: 'submit',
      }),
    ).rejects.toThrow(/already in use/);
  });
});
