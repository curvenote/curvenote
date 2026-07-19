export type AuthorFieldSchema = {
  name: string;
  title: string;
  required?: boolean;
};

export type Author = {
  id: string;
  name: string;
  email?: string;
  corresponding?: boolean;
  orcid?: string;
  /** IDs referencing the global affiliations list. */
  affiliationIds: string[];
};

export type Affiliation = {
  id: string;
  name: string;
  ror?: string;
  /** Fields that came from ROR API (read-only). Array of field names like ['name', 'city', 'country']. */
  rorFields?: string[];
  department?: string;
  address?: string;
  city?: string;
  country?: string;
  email?: string;
};

/** ORCID search API hit (name typeahead or search-by-id). */
export type OrcidSearchHit = {
  orcid: string;
  name: string;
  firstAffiliation?: string;
  email?: string;
};

/** ROR search API hit (affiliation typeahead). */
export type RorSearchHit = {
  name: string;
  ror: string;
  city?: string;
  country?: string;
};
