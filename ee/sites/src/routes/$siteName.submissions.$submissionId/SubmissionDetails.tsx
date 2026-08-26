import { primitives, clientCheckSiteScopes, formatDate, scopes, cn } from '@curvenote/scms-core';
import { SquareCheckBig, ExternalLink, Eye } from 'lucide-react';
import classNames from 'classnames';
import type { ReactNode } from 'react';
import { Slugs, getSlugSuggestion } from './Slugs.js';
import { Kinds } from './Kinds.js';
import { buildUrl } from 'doi-utils';
import { useLoaderData } from 'react-router';
import { Collections } from './Collections.js';
import { PublicationDate } from './PublicationDate.js';
import type { SubmissionDetailPageData } from './loader.server.js';
import {
  emptyDetailValue,
  getStatusBanners,
  versionCountLabel,
  type StatusBanner,
} from './SubmissionDetails.utils.js';

type DetailRowProps = {
  label: string;
  children: ReactNode;
  labelClassName?: string;
};

type StatusBannerRowProps = {
  banner: StatusBanner;
};

type SubmissionDetailsProps = {
  baseUrl?: string;
};

function DetailRow({ label, children, labelClassName }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 border-b border-border last:border-b-0 md:flex-row md:items-center md:gap-4 md:px-6">
      <div className={cn('text-sm shrink-0 text-foreground md:w-44 lg:w-48', labelClassName)}>
        {label}
      </div>
      <div className="flex gap-2 items-center min-w-0 flex-1">{children}</div>
    </div>
  );
}

function StatusBannerRow({ banner }: StatusBannerRowProps) {
  if (banner.kind === 'published') {
    return (
      <div
        className="flex flex-wrap gap-x-2 gap-y-1 items-center px-4 py-3 text-sm border-b bg-success/10 border-border text-foreground md:px-6"
        title="view latest published"
      >
        <SquareCheckBig
          className="inline-block w-4 h-4 stroke-[3px] stroke-success shrink-0 align-text-bottom"
          aria-hidden
        />
        <span className="break-words">
          Version created {formatDate(banner.dateCreated, 'MMMM dd, y HH:ss')} is{' '}
          <strong>Published</strong>
        </span>
        <a
          href={banner.href}
          className="inline-flex gap-1 items-center text-primary hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          view latest
          <ExternalLink className="inline-block w-4 h-4 shrink-0" aria-hidden />
        </a>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap gap-x-2 gap-y-1 items-center px-4 py-3 text-sm border-b bg-warning/10 border-border text-foreground md:px-6"
      title={`open preview for version ${formatDate(banner.dateCreated, 'MMMM dd, y HH:ss')}`}
    >
      <Eye
        className="inline-block w-4 h-4 stroke-[2px] stroke-warning shrink-0 align-text-bottom"
        aria-hidden
      />
      <span className="break-words">
        {formatDate(banner.dateCreated, 'MMMM dd, y HH:ss')} version is{' '}
        <strong className="capitalize">{banner.statusLabel}</strong>
      </span>
      <a
        href={banner.href}
        className="inline-flex gap-1 items-center text-primary hover:underline"
        target="_blank"
        rel="noreferrer noopener"
      >
        (preview
        <ExternalLink className="inline-block w-4 h-4 shrink-0" aria-hidden />)
      </a>
    </div>
  );
}

export function SubmissionDetails({ baseUrl }: SubmissionDetailsProps) {
  const {
    userScopes,
    submission,
    submissionVersions,
    site,
    signature,
    slugs,
    collections,
    workflow,
  } = useLoaderData<SubmissionDetailPageData>();

  let activeVersionIndex = submissionVersions.findIndex(
    (version) => version.id === submission.active_version_id,
  );
  if (activeVersionIndex === -1) activeVersionIndex = 0;
  const activeVersion = submissionVersions[activeVersionIndex];
  const currentState = workflow.states[activeVersion.status];
  const hasActiveNotPublished = !currentState?.published;

  const published = submission.published_version_id
    ? submissionVersions.find((v) => v.id === submission.published_version_id)
    : undefined;
  const datePublished = submission.date_published;

  const doi = activeVersion.site_work.doi;

  const submissionCollectionMatch = collections.some((c) => c.id === submission.collection.id);

  const referenceCollection = collections.find((c) => c.id === submission.collection.id);

  const slugSuggestion = getSlugSuggestion(site, activeVersion.site_work.doi);

  const canUpdate = clientCheckSiteScopes(userScopes, [scopes.site.submissions.update], site.name);

  const statusBanners = getStatusBanners({
    baseUrl,
    signature,
    activeVersion,
    activeStatusLabel: currentState?.label ?? activeVersion.status,
    hasActiveNotPublished,
    publishedVersion: published,
    submissionSlug: submission.slug,
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs tracking-wider uppercase text-muted-foreground">
          SUBMISSION DETAILS
        </span>
        <span className="text-sm text-muted-foreground">
          {versionCountLabel(submissionVersions.length)}
        </span>
      </div>

      <primitives.Card lift className="overflow-hidden p-0 rounded-md">
        {statusBanners.map((banner) => (
          <StatusBannerRow key={banner.kind} banner={banner} />
        ))}

        <DetailRow label="Publication Date">
          <PublicationDate
            submissionId={submission.id}
            datePublished={datePublished}
            canUpdate={canUpdate}
          />
        </DetailRow>

        <DetailRow
          label="Collection"
          labelClassName={classNames({
            'font-semibold text-destructive': !submissionCollectionMatch,
          })}
        >
          <Collections
            submissionId={submission.id}
            collectionId={submission.collection.id}
            collections={collections}
            canUpdate={canUpdate}
          />
        </DetailRow>

        <DetailRow label="Submission Kind">
          <Kinds
            submissionId={submission.id}
            collection={referenceCollection}
            kindId={submission.kind.id}
            kindNameOrTitle={submission.kind.content?.title ?? submission.kind.name}
            canUpdate={canUpdate}
          />
        </DetailRow>

        <DetailRow label="Slug">
          <Slugs
            siteId={site.id}
            submissionId={submission.id}
            slugs={slugs}
            fallback={activeVersion.site_work.id}
            canEdit={canUpdate}
            suggestion={slugSuggestion}
            baseUrl={`${baseUrl}/articles/`}
          />
        </DetailRow>

        <DetailRow label="DOI">
          {doi ? (
            <a
              href={buildUrl(doi)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex gap-1 items-center text-sm break-all text-primary hover:underline"
            >
              {doi}
              <ExternalLink className="inline-block w-4 h-4 shrink-0" aria-hidden />
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">{emptyDetailValue()}</span>
          )}
        </DetailRow>
      </primitives.Card>
    </div>
  );
}
