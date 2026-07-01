import { describe, expect, it } from 'vitest';
import { parseDoiFormat } from '../../app/routes/app/works.$workId.details/doiFormat.js';
import { validateAndNormalizeDoi } from '../../app/routes/app/works.$workId.details/doi.server.js';

describe('parseDoiFormat', () => {
  it('accepts a DOI prefix/suffix', () => {
    expect(parseDoiFormat('10.1234/example')).toEqual({
      ok: true,
      normalized: '10.1234/example',
    });
  });

  it('accepts a full doi.org URL', () => {
    expect(parseDoiFormat('https://doi.org/10.1234/example')).toEqual({
      ok: true,
      normalized: '10.1234/example',
    });
  });

  it('rejects invalid DOI format', () => {
    expect(parseDoiFormat('not-a-doi')).toEqual({ ok: false, error: 'Invalid DOI format' });
  });

  it('rejects empty input', () => {
    expect(parseDoiFormat('   ')).toEqual({ ok: false, error: 'DOI is required' });
  });
});

describe('validateAndNormalizeDoi', () => {
  it('normalizes valid DOI input', () => {
    expect(validateAndNormalizeDoi('10.1234/example')).toEqual({
      ok: true,
      normalized: '10.1234/example',
    });
  });
});
