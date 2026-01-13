import {
  primitives,
  clientCheckSiteScopes,
  formatDate,
  SectionWithHeading,
  scopes,
} from '@curvenote/scms-core';
import type { sites, SiteContext } from '@curvenote/scms-server';
import { SquareCheckBig, ExternalLink, Eye, FileText } from 'lucide-react';
import classNames from 'classnames';
import type { SubmissionDTO, SubmissionVersionDTO } from '@curvenote/common';
import type { SlugsDTO } from './types.server.js';
import { Slugs, getSlugSuggestion } from './Slugs.js';
import type { Prisma } from '@prisma/client';
import { Kinds } from './Kinds.js';
import { buildUrl } from 'doi-utils';
import { useLoaderData } from 'react-router';
import { Collections } from './Collections.js';
import { PublicationDate } from './PublicationDate.js';
import type { Workflow } from '@curvenote/scms-core';

export function SubmissionDetails({ baseUrl }: { baseUrl?: string }) {
  const {
    userScopes,
    submission,
    submissionVersions,
    site,
    signature,
    slugs,
    collections,
    workflow,
  } = useLoaderData() as {
    user: SiteContext['user'];
    userScopes: string[];
    submission: SubmissionDTO;
    submissionVersions: SubmissionVersionDTO[];
    site: ReturnType<typeof sites.formatSiteDTO>;
    signature: string;
    slugs: SlugsDTO;
    collections: Prisma.PromiseReturnType<typeof sites.collections.list>;
    workflow: Workflow;
    poll: boolean;
  };

  let activeVersionIndex = submissionVersions.findIndex(
    (version) => version.id === submission.active_version_id,
  );
  if (activeVersionIndex === -1) activeVersionIndex = 0;
  const activeVersion = submissionVersions[activeVersionIndex];
  const currentState = workflow.states[activeVersion.status];
  const hasActiveNotPublished = !currentState?.published;
  const previewUrl = hasActiveNotPublished
    ? `${baseUrl}/previews/${activeVersion.id}?preview=${signature}`
    : undefined;

  // note relies on backend returning sorted versions, with most recent first
  const published = submission.published_version_id
    ? submissionVersions.find((v) => v.id === submission.published_version_id)
    : undefined;
  const datePublished = submission.date_published;
  const hasPublished = !!published;

  // TODO this can fall back to submission.work_id once that is in place
  const publishedUrl = `${baseUrl}/articles/${submission.slug ?? published?.site_work.id}`;

  const doi = activeVersion.site_work.doi;

  const submissionCollectionMatch = collections.items.some(
    (c) => c.id === submission.collection.id,
  );

  const referenceCollection = collections.items.find((c) => c.id === submission.collection.id);

  const slugSuggestion = getSlugSuggestion(site, activeVersion.site_work.doi);

  const canUpdate = clientCheckSiteScopes(userScopes, [scopes.site.submissions.update], site.name);

  return (
    <SectionWithHeading heading="Submission Details" icon={FileText}>
      <primitives.Card lift className="p-8">
        <div className="space-y-4">
          {hasActiveNotPublished && (
            <div
              className="space-x-1"
              title={`open preview for version ${formatDate(activeVersion.date_created, 'hh:mm MMMM dd, y')}`}
            >
              <Eye className="inline-block w-5 h-5 stroke-[2px] stroke-orange-500 align-text-bottom" />{' '}
              {formatDate(activeVersion.date_created, 'MMMM dd, y HH:ss')} version is{' '}
              {currentState?.label ?? activeVersion.status}{' '}
              <a
                href={previewUrl}
                className="inline-block -mt-[2px] first-letter:cursor-pointer"
                target="_blank"
                rel="noreferrer noopener"
              >
                (
                <span className="underline">
                  preview
                  <ExternalLink className="inline-block w-4 h-4 align-middle ml-[2px] mb-[2px]" />
                </span>
                )
              </a>
            </div>
          )}
          {hasPublished && (
            <div className="space-x-1" title="view latest published">
              <SquareCheckBig className="inline-block w-5 h-5 stroke-[3px] stroke-green-700 align-text-bottom" />{' '}
              Version created {formatDate(published.date_created, 'MMMM dd, y HH:ss')} is PUBLISHED
              <a
                href={publishedUrl}
                className="inline-block -mt-[2px] cursor-pointer"
                target="_blank"
                rel="noreferrer noopener"
              >
                (<span className="underline">view latest</span>
                <ExternalLink className="inline-block w-4 h-4 align-middle ml-[2px] mb-[2px]" />)
              </a>
            </div>
          )}
          <div>
            {submissionVersions.length} Version
            <span>{submissionVersions.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex justify-between">
            <div
              className=""
              title="The publication date, set manually or based on the original published version"
            >
              Publication Date
            </div>
            <PublicationDate
              submissionId={submission.id}
              datePublished={datePublished}
              canUpdate={canUpdate}
            />
          </div>
          <div
            className={classNames('flex justify-between', {
              'font-semibold text-red-500': !submissionCollectionMatch,
            })}
          >
            <div className="">Collection</div>
            <Collections
              submissionId={submission.id}
              collectionId={submission.collection.id}
              collections={collections.items}
              canUpdate={canUpdate}
            />
          </div>
          <div className={classNames('flex justify-between')}>
            <div className="">Submission Kind</div>
            <Kinds
              submissionId={submission.id}
              collection={referenceCollection!}
              kindId={submission.kind.id}
              kindNameOrTitle={submission.kind.content?.title ?? submission.kind.name}
              canUpdate={canUpdate}
            />
          </div>
          <div className="flex justify-between">
            <Slugs
              siteId={site.id}
              submissionId={submission.id}
              slugs={slugs}
              fallback={activeVersion.site_work.id}
              canEdit={clientCheckSiteScopes(
                userScopes,
                [scopes.site.submissions.update],
                site.name,
              )}
              suggestion={slugSuggestion}
              baseUrl={`${baseUrl}/articles/`}
            />
          </div>
          <div className="flex justify-between">
            <div className="">DOI</div>
            {doi ? (
              <p>
                <a
                  href={buildUrl(doi)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {doi}
                  <ExternalLink className="inline-block w-4 h-4 align-middle ml-[2px] mb-[2px]" />
                </a>
              </p>
            ) : (
              <p className="text-gray-500">none</p>
            )}
          </div>
          <div className="flex justify-between">
            <div className="text-gray-500">MyST Project Key</div>
            <p className={classNames('text-gray-500')}>
              {submissionVersions?.[0]?.site_work.key ?? 'none'}
            </p>
          </div>
        </div>
      </primitives.Card>
    </SectionWithHeading>
  );
}
