// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { verificationInvalidated } from './license.js';

const cdn = 'https://cdn.curvenote.com/static/site/dhr';
const matter = { family: 'Matter', faces: [{ src: `${cdn}/Matter-Regular.woff2`, weight: 400 }] };
const license = { files: [{ src: `${cdn}/license.pdf`, name: 'license.pdf' }], verified: true };
const before = { fonts: { body: matter }, license };

describe('verificationInvalidated', () => {
  it('is false when nothing a license covers has changed', () => {
    expect(verificationInvalidated(before, before)).toBe(false);
    // fallback, loading and a Google heading are not licensed material
    expect(
      verificationInvalidated(before, {
        fonts: {
          body: { ...matter, fallback: 'serif', display: 'block' },
          heading: { family: 'Lora', source: 'google' },
        },
        license,
      }),
    ).toBe(false);
    // the verified flag itself is not part of the fingerprint
    expect(
      verificationInvalidated(before, { ...before, license: { ...license, verified: false } }),
    ).toBe(false);
  });

  it('is true when an uploaded face is added, removed, renamed or re-weighted', () => {
    const faces = matter.faces;
    expect(
      verificationInvalidated(before, {
        ...before,
        fonts: {
          body: { ...matter, faces: [...faces, { src: `${cdn}/Matter-Bold.woff2`, weight: 700 }] },
        },
      }),
    ).toBe(true);
    expect(
      verificationInvalidated(before, { ...before, fonts: { body: { ...matter, faces: [] } } }),
    ).toBe(true);
    expect(
      verificationInvalidated(before, {
        ...before,
        fonts: { body: { ...matter, family: 'Matter 2' } },
      }),
    ).toBe(true);
    expect(
      verificationInvalidated(before, {
        ...before,
        fonts: { body: { ...matter, faces: [{ ...faces[0], weight: 500 }] } },
      }),
    ).toBe(true);
  });

  it('is true when a slot becomes or stops being self-hosted', () => {
    expect(verificationInvalidated(before, { ...before, fonts: {} })).toBe(true);
    expect(
      verificationInvalidated(before, {
        ...before,
        fonts: { ...before.fonts, small: { family: 'X', faces: [{ src: `${cdn}/x.woff2` }] } },
      }),
    ).toBe(true);
  });

  it('is true when the license files change', () => {
    expect(verificationInvalidated(before, { ...before, license: { files: [] } })).toBe(true);
    expect(
      verificationInvalidated(before, {
        ...before,
        license: { files: [...license.files, { src: `${cdn}/receipt.pdf`, name: 'receipt.pdf' }] },
      }),
    ).toBe(true);
  });
});
