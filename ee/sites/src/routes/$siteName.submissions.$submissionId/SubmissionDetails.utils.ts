export const SUBMISSION_DETAIL_FORM_ACTIONS = {
  setDatePublished: 'set-date-published',
  setCollection: 'set-collection',
  setKind: 'set-kind',
  slugAdd: 'slug-add',
  slugRemove: 'slug-remove',
  slugSetPrimary: 'slug-set-primary',
} as const;

export const SUBMISSION_DETAIL_FIELDS = {
  publicationDate: 'publicationDate',
  collection: 'collection',
  kind: 'kind',
  slug: 'slug',
  doi: 'doi',
} as const;

export type SubmissionDetailFieldKey =
  (typeof SUBMISSION_DETAIL_FIELDS)[keyof typeof SUBMISSION_DETAIL_FIELDS];

export type SubmissionDetailEditableFieldKey = Exclude<SubmissionDetailFieldKey, 'doi'>;

export type StatusBanner =
  | {
      kind: 'published';
      dateCreated: string;
      href: string;
    }
  | {
      kind: 'preview';
      dateCreated: string;
      statusLabel: string;
      href: string;
    };

type StatusBannerInput = {
  baseUrl?: string;
  signature: string;
  activeVersion: {
    id: string;
    date_created: string;
    status: string;
  };
  activeStatusLabel: string;
  hasActiveNotPublished: boolean;
  publishedVersion?: {
    id: string;
    date_created: string;
    site_work: { id: string };
  };
  submissionSlug?: string;
};

export function versionCountLabel(count: number): string {
  return count === 1 ? '1 version' : `${count} versions`;
}

export function emptyDetailValue(): string {
  return 'Not assigned';
}

export function getVisibleDetailFields(): SubmissionDetailFieldKey[] {
  return [
    SUBMISSION_DETAIL_FIELDS.publicationDate,
    SUBMISSION_DETAIL_FIELDS.collection,
    SUBMISSION_DETAIL_FIELDS.kind,
    SUBMISSION_DETAIL_FIELDS.slug,
    SUBMISSION_DETAIL_FIELDS.doi,
  ];
}

export function getEditableFields(canUpdate: boolean): SubmissionDetailEditableFieldKey[] {
  if (!canUpdate) return [];
  return [
    SUBMISSION_DETAIL_FIELDS.publicationDate,
    SUBMISSION_DETAIL_FIELDS.collection,
    SUBMISSION_DETAIL_FIELDS.kind,
    SUBMISSION_DETAIL_FIELDS.slug,
  ];
}

export function getStatusBanners({
  baseUrl,
  signature,
  activeVersion,
  activeStatusLabel,
  hasActiveNotPublished,
  publishedVersion,
  submissionSlug,
}: StatusBannerInput): StatusBanner[] {
  const banners: StatusBanner[] = [];

  if (publishedVersion) {
    banners.push({
      kind: 'published',
      dateCreated: publishedVersion.date_created,
      href: `${baseUrl}/articles/${submissionSlug ?? publishedVersion.site_work.id}`,
    });
  }

  if (hasActiveNotPublished) {
    banners.push({
      kind: 'preview',
      dateCreated: activeVersion.date_created,
      statusLabel: activeStatusLabel,
      href: `${baseUrl}/previews/${activeVersion.id}?preview=${signature}`,
    });
  }

  return banners;
}
