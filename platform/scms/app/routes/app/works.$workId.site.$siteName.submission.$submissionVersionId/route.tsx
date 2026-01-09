import type { Route } from './+types/route';
import { getPrismaClient, withSecureWorkContext } from '@curvenote/scms-server';
import {
  PageFrame,
  SectionWithHeading,
  work as workScopes,
  getBrandingFromMetaMatches,
  joinPageTitle,
  getWorkflow,
  primitives,
  registerExtensionWorkflows,
} from '@curvenote/scms-core';
import { redirect } from 'react-router';
import { GitBranch, Globe } from 'lucide-react';
import {
  getSubmissionForWorkAndSite,
  getSubmissionVersion,
  getSubmissionVersionsForWorkAndSite,
} from './db.server';
import { VersionInfoFooter } from './VersionInfoFooter';
import { UserSubmissionVersionTable } from './UserSubmissionVersionTable';
import { extensions } from '../../../extensions/client';

/**
 *
 * TODO this route belongs in the sites extension
 *
 */

export const loader = async (args: Route.LoaderArgs) => {
  const ctx = await withSecureWorkContext(args, [workScopes.submissions.read]);

  const { workId, siteName, submissionVersionId } = args.params as {
    workId: string;
    submissionVersionId: string;
    siteName: string;
  };

  // Get the submission for this work and site
  const submission = await getSubmissionForWorkAndSite(workId, siteName);
  if (!submission) {
    throw redirect(`/app/works/${workId}`);
  }

  // Get the specific version being viewed
  const viewingVersion = await getSubmissionVersion(submissionVersionId);
  if (!viewingVersion) {
    throw redirect(`/app/works/${workId}`);
  }

  // Verify this version belongs to the correct work and site
  if (
    viewingVersion.work_version.work_id !== workId ||
    viewingVersion.submission.site.name !== siteName
  ) {
    throw redirect(`/app/works/${workId}`);
  }

  // Get all submission versions for the table
  const submissionVersions = await getSubmissionVersionsForWorkAndSite(workId, siteName);

  // Get workflow configuration
  const workflow = getWorkflow(
    ctx.$config,
    registerExtensionWorkflows(extensions),
    submission.collection.workflow,
  );

  // Determine active/published version - use the first version if no active_version_id
  const activeVersion = submissionVersions[0];

  // Get work title for metadata
  const workTitle = ctx.workDTO.title;

  // Find the default domain for the site
  const prisma = await getPrismaClient();
  const defaultDomain = await prisma.domain.findFirst({
    where: {
      site_id: submission.site.id,
      default: true,
    },
  });

  // Determine overall publication status and find published version
  const publishedVersion = submissionVersions.find((v) => v.status === 'published');
  const overallStatus = publishedVersion ? 'published' : activeVersion.status;

  // Get site logo from metadata if available
  const siteMetadata = submission.site.metadata as any;
  const siteLogo = siteMetadata?.logo || null;

  // Construct published article URL using primary slug or work ID
  const primarySlug = submission.slugs?.find((s) => s.primary)?.slug;
  const articleSlugOrId = primarySlug || workId;
  const publishedArticleUrl =
    publishedVersion && defaultDomain?.hostname
      ? `https://${defaultDomain.hostname}/articles/${articleSlugOrId}`
      : null;

  return {
    work: ctx.workDTO,
    workId,
    siteName,
    submission,
    submissionVersions,
    viewingVersion,
    activeVersion,
    workflow,
    workTitle,
    defaultDomain: defaultDomain?.hostname || null,
    overallStatus,
    publishedVersion: publishedVersion || null,
    siteLogo,
    publishedArticleUrl,
  };
};

export const meta: Route.MetaFunction = ({ matches, loaderData }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [
    {
      title: joinPageTitle(
        loaderData?.workTitle,
        loaderData?.siteName,
        'Submission',
        branding.title,
      ),
    },
  ];
};

export default function WorkSubmissionDetailRoute({ loaderData }: Route.ComponentProps) {
  const {
    work,
    workId,
    siteName,
    submission,
    submissionVersions,
    viewingVersion,
    activeVersion,
    workflow,
    workTitle,
    defaultDomain,
    overallStatus,
    siteLogo,
    publishedArticleUrl,
  } = loaderData;

  const truncatedTitle = workTitle
    ? workTitle.length > 32
      ? workTitle.substring(0, 32) + '...'
      : workTitle
    : 'Untitled Work';

  const breadcrumbs = [
    { label: 'Works', href: '/app/works' },
    { label: truncatedTitle, href: `/app/works/${workId}` },
    { label: `${siteName} Submission`, isCurrentPage: true },
  ];

  // Prepare version panel data
  const activeVersionPanel = {
    versionId: activeVersion.id,
    date: activeVersion.date_created,
    uploadedBy:
      activeVersion.submission.submitted_by.display_name ||
      activeVersion.submission.submitted_by.username ||
      activeVersion.submission.submitted_by.email ||
      activeVersion.submission.submitted_by.id ||
      'Unknown',
    status: activeVersion.status,
    doi: work.doi || null,
    workKey: work.key || null,
    isActive: true,
    isViewing: viewingVersion.id === activeVersion.id,
  };

  const viewingVersionPanel =
    viewingVersion.id !== activeVersion.id
      ? {
          versionId: viewingVersion.id,
          date: viewingVersion.date_created,
          uploadedBy:
            viewingVersion.submission.submitted_by.display_name ||
            viewingVersion.submission.submitted_by.username ||
            viewingVersion.submission.submitted_by.email ||
            viewingVersion.submission.submitted_by.id ||
            'Unknown',
          status: viewingVersion.status,
          doi: work.doi || null,
          workKey: work.key || null,
          isActive: false,
          isViewing: true,
        }
      : undefined;

  return (
    <PageFrame title={`Submission Details`} breadcrumbs={breadcrumbs} className="max-w-4xl">
      <div className="mt-4 space-y-6 md:space-y-12">
        <SectionWithHeading heading="Submitted to" icon={Globe}>
          <primitives.Card lift className="p-6">
            <div className="flex gap-6">
              {siteLogo && (
                <div className="shrink-0">
                  <img
                    src={siteLogo}
                    alt={`${submission.site.title} logo`}
                    className="object-contain w-24 h-24 rounded"
                  />
                </div>
              )}
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{submission.site.title}</h3>
                  {defaultDomain && (
                    <a
                      href={`https://${defaultDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {defaultDomain}
                    </a>
                  )}
                </div>
                {submission.site.description && (
                  <p className="text-sm text-gray-600">{submission.site.description}</p>
                )}
              </div>
            </div>
          </primitives.Card>
        </SectionWithHeading>

        <SectionWithHeading heading="Latest Information" icon={GitBranch}>
          <VersionInfoFooter
            activeVersionPanel={activeVersionPanel}
            viewingVersionPanel={viewingVersionPanel}
            overallStatus={overallStatus}
            publishedVersionLink={publishedArticleUrl}
          />
        </SectionWithHeading>

        <SectionWithHeading heading="All Versions" icon={GitBranch}>
          <primitives.Card lift>
            <UserSubmissionVersionTable
              submissionVersions={submissionVersions}
              workflow={workflow}
              viewingSubmissionVersionId={viewingVersion.id}
              workId={workId}
              siteName={siteName}
            />
          </primitives.Card>
        </SectionWithHeading>
      </div>
    </PageFrame>
  );
}
