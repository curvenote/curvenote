export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidOrcid(orcid: string): boolean {
  return /^\d{4}-\d{4}-\d{4}-\d{4}$/.test(orcid.trim());
}

/** Extract canonical ORCID (0000-0000-0000-0000) from input; supports URL or plain id. Returns null if not parseable. */
export function extractOrcidId(input: string): string | null {
  const s = (input ?? '').trim();
  const withoutUrl = s.replace(/^https?:\/\/[^/]*\/?/i, '').trim();
  const digits = withoutUrl.replace(/[^0-9x]/gi, '');
  if (digits.length !== 16 || !/^\d{4}\d{4}\d{4}\d{3}[\dx]$/i.test(digits)) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}`;
}

/** Normalize ORCID for comparison: strip URL prefix, then keep only digits and X, lowercase. */
export function normalizeOrcidForCompare(orcid: string | undefined): string {
  const s = (orcid ?? '').trim();
  // Strip common URL prefix so "https://orcid.org/0000-0002-1825-0097" matches "0000-0002-1825-0097"
  const withoutUrl = s.replace(/^https?:\/\/[^/]*\/?/i, '').trim();
  return withoutUrl.replace(/[^0-9x]/gi, '').toLowerCase();
}

/** Normalize affiliation for comparison: all fields normalized and joined. */
export function normalizeAffiliationForCompare(aff: {
  name?: string;
  ror?: string;
  department?: string;
  city?: string;
  country?: string;
}): string {
  const parts = [
    (aff.name ?? '').trim().toLowerCase(),
    (aff.ror ?? '').trim().toLowerCase(),
    (aff.department ?? '').trim().toLowerCase(),
    (aff.city ?? '').trim().toLowerCase(),
    (aff.country ?? '').trim().toLowerCase(),
  ];
  return parts.join('|');
}

/** Author-list validation errors. */
export function getAuthorFieldErrors(authors: unknown[]): { message: string }[] {
  const errors: { message: string }[] = [];
  const list = Array.isArray(authors) ? authors : [];

  if (list.length > 0) {
    const correspondingCount = list.filter((a: any) => a?.corresponding === true).length;
    if (correspondingCount === 0) {
      errors.push({ message: 'Please mark at least one author as corresponding.' });
    }
  }

  for (const [i, a] of list.entries()) {
    const name = String((a as any)?.name ?? '').trim();
    const email = String((a as any)?.email ?? '').trim();
    const orcid = String((a as any)?.orcid ?? '').trim();
    const corresponding = (a as any)?.corresponding === true;
    const affiliationIds = Array.isArray((a as any)?.affiliationIds)
      ? ((a as any).affiliationIds as unknown[]).filter(
          (id): id is string => typeof id === 'string',
        )
      : [];

    if (!name) {
      errors.push({ message: `Author ${i + 1}: name is required.` });
    }

    if (corresponding) {
      if (!email) {
        errors.push({
          message: `Author ${i + 1}: email is required for corresponding authors.`,
        });
      } else if (!isValidEmail(email)) {
        errors.push({ message: `Author ${i + 1}: email format is invalid.` });
      }
    } else if (email && !isValidEmail(email)) {
      errors.push({ message: `Author ${i + 1}: email format is invalid.` });
    }

    if (orcid && !isValidOrcid(orcid)) {
      errors.push({
        message: `Author ${i + 1}: ORCID must be in the format 0000-0000-0000-0000.`,
      });
    }

    if (affiliationIds.length === 0) {
      errors.push({
        message: `Author ${i + 1}: at least one affiliation is required.`,
      });
    }
  }

  const orcidToIndices = new Map<string, number[]>();
  for (const [i, a] of list.entries()) {
    const orcid = String((a as any)?.orcid ?? '').trim();
    if (!orcid) continue;
    const key = normalizeOrcidForCompare(orcid);
    if (!orcidToIndices.has(key)) orcidToIndices.set(key, []);
    const indices = orcidToIndices.get(key);
    if (indices) indices.push(i + 1);
  }
  for (const [, indices] of orcidToIndices) {
    if (indices.length > 1) {
      errors.push({
        message: `Duplicate ORCID: the same ORCID appears for authors ${indices.join(', ')}.`,
      });
    }
  }

  return errors;
}
