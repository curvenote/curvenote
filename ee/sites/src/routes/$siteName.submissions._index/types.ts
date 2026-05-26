export type SubmissionsIndexItem = {
  id: string;
  title: string;
  authors: { name: string }[];
  datePublished?: string;
};

export type SubmissionsIndexPage = {
  items: SubmissionsIndexItem[];
  page: number;
  perPage: number;
  total: number;
};
