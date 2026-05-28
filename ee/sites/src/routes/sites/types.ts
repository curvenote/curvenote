/** Minimal site row for the My Sites grid (not full SiteDTO / API shape). */
export type SiteCardItem = {
  id: string;
  name: string;
  title: string;
  /** Public site URL from the primary domain, when configured. */
  url: string;
  external: boolean;
  logo: string;
  logo_dark?: string;
};

export type SiteCardListing = {
  items: SiteCardItem[];
};
