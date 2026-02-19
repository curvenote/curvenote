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
