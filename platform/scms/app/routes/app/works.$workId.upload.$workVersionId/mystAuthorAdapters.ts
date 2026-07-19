import { extractOrcidId, type Affiliation, type Author } from '@curvenote/scms-core';

type MystRecord = Record<string, unknown>;

export type AuthorFieldMetadata = {
  authors: Author[];
  affiliations: Affiliation[];
};

export type MystFrontmatterWithAuthors = MystRecord & {
  authors?: MystRecord[];
  affiliations?: MystRecord[];
};

function isRecord(value: unknown): value is MystRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeOrcid(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  return extractOrcidId(raw) ?? raw;
}

function generatedAuthorId(index: number): string {
  return `contributors-generated-uid-${index}`;
}

function generatedAffiliationId(index: number): string {
  return `a${index + 1}`;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base.trim() || 'id';
  let counter = 2;
  while (used.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  used.add(id);
  return id;
}

function affiliationName(aff: MystRecord, fallback: string): string {
  return asString(aff.name) ?? asString(aff.institution) ?? fallback;
}

function normalizeAffiliation(
  value: unknown,
  usedIds: Set<string>,
  preferredIndex: number,
): Affiliation | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return {
      id: uniqueId(trimmed, usedIds),
      name: trimmed,
    };
  }
  if (!isRecord(value)) return null;
  const id = uniqueId(asString(value.id) ?? generatedAffiliationId(preferredIndex), usedIds);
  return {
    id,
    name: affiliationName(value, id),
    ...(asString(value.ror) && { ror: asString(value.ror) }),
    ...(asString(value.department) && { department: asString(value.department) }),
    ...(asString(value.address) && { address: asString(value.address) }),
    ...(asString(value.city) && { city: asString(value.city) }),
    ...(asString(value.country) && { country: asString(value.country) }),
    ...(asString(value.email) && { email: asString(value.email) }),
  };
}

function addAffiliation(
  affiliations: Affiliation[],
  affiliationById: Map<string, Affiliation>,
  aff: Affiliation | null,
): string | null {
  if (!aff) return null;
  const existing = affiliationById.get(aff.id);
  if (!existing) {
    affiliationById.set(aff.id, aff);
    affiliations.push(aff);
  }
  return aff.id;
}

export function mystFrontmatterToAuthorField(
  frontmatter: unknown,
  fallbackAuthorNames: string[] = [],
): AuthorFieldMetadata {
  const fm = isRecord(frontmatter) ? frontmatter : {};
  const usedAffiliationIds = new Set<string>();
  const affiliations: Affiliation[] = [];
  const affiliationById = new Map<string, Affiliation>();

  const rawAffiliations = Array.isArray(fm.affiliations) ? fm.affiliations : [];
  rawAffiliations.forEach((raw, index) => {
    addAffiliation(
      affiliations,
      affiliationById,
      normalizeAffiliation(raw, usedAffiliationIds, index),
    );
  });

  const rawAuthors =
    Array.isArray(fm.authors) && fm.authors.length > 0 ? fm.authors : fallbackAuthorNames;
  const usedAuthorIds = new Set<string>();

  const authors = rawAuthors
    .map((raw, index): Author | null => {
      const rawAuthor: MystRecord =
        typeof raw === 'string' ? { name: raw } : isRecord(raw) ? raw : {};
      const name =
        asString(rawAuthor.name) ?? asString((rawAuthor.nameParsed as MystRecord)?.literal);
      if (!name) return null;
      const id = uniqueId(asString(rawAuthor.id) ?? generatedAuthorId(index), usedAuthorIds);
      const rawAuthorAffiliations = Array.isArray(rawAuthor.affiliations)
        ? rawAuthor.affiliations
        : rawAuthor.affiliations != null
          ? [rawAuthor.affiliations]
          : [];
      const affiliationIds = rawAuthorAffiliations
        .map((rawAff, affIndex) => {
          if (typeof rawAff === 'string') {
            const trimmed = rawAff.trim();
            if (!trimmed) return null;
            if (!affiliationById.has(trimmed)) {
              addAffiliation(affiliations, affiliationById, {
                id: uniqueId(trimmed, usedAffiliationIds),
                name: trimmed,
              });
            }
            return trimmed;
          }
          return addAffiliation(
            affiliations,
            affiliationById,
            normalizeAffiliation(rawAff, usedAffiliationIds, affiliations.length + affIndex),
          );
        })
        .filter((affId): affId is string => affId != null);

      return {
        id,
        name,
        email: asString(rawAuthor.email),
        corresponding: rawAuthor.corresponding === true,
        orcid: normalizeOrcid(rawAuthor.orcid),
        affiliationIds,
      };
    })
    .filter((author): author is Author => author != null);

  return { authors, affiliations };
}

function mergeMystAuthor(existing: MystRecord | undefined, author: Author): MystRecord {
  const next: MystRecord = {
    ...(existing ?? {}),
    id: author.id,
    name: author.name,
    affiliations: author.affiliationIds,
  };
  const orcid = normalizeOrcid(author.orcid);
  if (orcid) next.orcid = orcid;
  else delete next.orcid;
  if (author.email) next.email = author.email;
  else delete next.email;
  if (author.corresponding != null) next.corresponding = author.corresponding;
  if (existing?.name !== author.name) delete next.nameParsed;
  return next;
}

function mergeMystAffiliation(
  existing: MystRecord | undefined,
  affiliation: Affiliation,
): MystRecord {
  const next: MystRecord = {
    ...(existing ?? {}),
    id: affiliation.id,
    name: affiliation.name,
  };
  const fields = ['ror', 'department', 'address', 'city', 'country', 'email'] as const;
  fields.forEach((field) => {
    const value = affiliation[field];
    if (value) next[field] = value;
    else delete next[field];
  });
  return next;
}

export function authorFieldToMystFrontmatter(
  value: AuthorFieldMetadata,
  existingFrontmatter: unknown,
): MystFrontmatterWithAuthors {
  const existing = isRecord(existingFrontmatter) ? existingFrontmatter : {};
  const existingAuthors = Array.isArray(existing.authors) ? existing.authors.filter(isRecord) : [];
  const existingAffiliations = Array.isArray(existing.affiliations)
    ? existing.affiliations.filter(isRecord)
    : [];
  const existingAuthorById = new Map(
    existingAuthors.map((author) => [asString(author.id), author]).filter(([id]) => id != null) as [
      string,
      MystRecord,
    ][],
  );
  const existingAffiliationById = new Map(
    existingAffiliations
      .map((affiliation) => [asString(affiliation.id), affiliation])
      .filter(([id]) => id != null) as [string, MystRecord][],
  );

  return {
    ...existing,
    authors: value.authors.map((author) =>
      mergeMystAuthor(existingAuthorById.get(author.id), author),
    ),
    affiliations: value.affiliations.map((affiliation) =>
      mergeMystAffiliation(existingAffiliationById.get(affiliation.id), affiliation),
    ),
  };
}

export function deriveWorkVersionAuthors(authors: MystRecord[]): string[] {
  return authors
    .map((author) => asString(author.name) ?? asString((author.nameParsed as MystRecord)?.literal))
    .filter((name): name is string => name != null);
}
