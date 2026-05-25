/** Minimal site row for the My Sites grid (not full SiteDTO / API shape). */
export type SiteCardItem = {
  id: string;
  name: string;
  title: string;
  external: boolean;
  logo: string;
  logo_dark?: string;
};

export type SiteCardListing = {
  items: SiteCardItem[];
};
