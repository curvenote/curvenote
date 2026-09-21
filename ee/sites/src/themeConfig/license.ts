import { FONT_SLOTS, fontSlotSource } from './fonts.js';
import type { FontLicense, ThemeFontsConfig } from './types.js';

/*
 * A verified license covers a specific set of uploaded files. Change what is served — a new
 * face, a renamed family, a swapped license file — and the verification no longer applies, so
 * the server clears it and the site goes back to "awaiting verification".
 */

/** The parts of the font config that a license is a judgement about: the self-hosted slots. */
function uploadedFingerprint(fonts: ThemeFontsConfig | undefined): string {
  const uploaded = FONT_SLOTS.filter((name) => fontSlotSource(fonts?.[name]) === 'custom').map(
    (name) => {
      const slot = fonts?.[name];
      return {
        name,
        family: slot?.family?.trim() ?? '',
        faces: (slot?.faces ?? [])
          .map((face) => `${face.src}|${face.weight ?? 400}|${face.style ?? 'normal'}`)
          .sort(),
      };
    },
  );
  return JSON.stringify(uploaded);
}

function licenseFingerprint(license: FontLicense | undefined): string {
  return JSON.stringify((license?.files ?? []).map((file) => file.src).sort());
}

/**
 * True when the fonts or license files a verification was granted for have changed, so the
 * `verified` flag must be dropped. Google and default slots, fallbacks, and loading settings
 * are not covered by a license and do not count.
 */
export function verificationInvalidated(
  before: { fonts?: ThemeFontsConfig; license?: FontLicense },
  after: { fonts?: ThemeFontsConfig; license?: FontLicense },
): boolean {
  return (
    uploadedFingerprint(before.fonts) !== uploadedFingerprint(after.fonts) ||
    licenseFingerprint(before.license) !== licenseFingerprint(after.license)
  );
}
