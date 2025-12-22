import type { MagicLinkHandler } from '../handlers.js';
import type { MagicLinkData } from '../../magic-links.server.js';
import { error404 } from '@curvenote/scms-core';
import { dbGetSite } from '../../../loaders/sites/get.server.js';
import { createPreviewToken } from '../../../sign.previews.server.js';
import { createPreviewUrl } from '../../../domains.server.js';
import { getPrismaClient } from '../../../prisma.server.js';
import { findImportantVersions } from '../../../loaders/sites/submissions/utils.server.js';

/**
 * Handler for submission_preview magic links
 *
 * This handler:
 * 1. Extracts submissionId and siteName from the magic link data
 * 2. Loads the site and submission from the database
 * 3. Gets the latest active version of the submission (not just the most recently created)
 * 4. Generates a preview token
 * 5. Creates and returns the preview URL (honors renderServiceUrl if configured)
 */
export const submissionPreviewHandler: MagicLinkHandler = {
  async handle(magicLink, context) {
    const data = magicLink.data as MagicLinkData;
    const { submissionId, siteName } = data;

    if (!submissionId || !siteName) {
      throw error404('Invalid link configuration');
    }

    // Load site information
    const siteDBO = await dbGetSite(siteName);
    if (!siteDBO) {
      throw error404('Site not found');
    }

    // Load submission with all versions to determine the active version
    const prisma = await getPrismaClient();
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        versions: {
          orderBy: { date_created: 'desc' },
        },
      },
    });

    if (!submission) {
      throw error404('Submission not found');
    }

    if (submission.versions.length === 0) {
      throw error404('No versions available');
    }

    // Find the active version using the same logic as the rest of the codebase.
    // The active version is the first PENDING or APPROVED version that is more recent
    // than the latest published version, or falls back to published if no active exists

    const idx = findImportantVersions(submission.versions);
    const activeVersion = submission.versions[idx.active ?? idx.published ?? 0];

    if (!activeVersion) {
      throw error404('No active version available');
    }

    const activeVersionId = activeVersion.id;

    // Generate preview token
    const signature = createPreviewToken(
      siteName,
      submissionId,
      context.$config.api.previewIssuer,
      context.$config.api.previewSigningSecret,
    );

    // Create preview URL - honor renderServiceUrl if configured for local development
    const renderServiceUrl = context.$config.app?.renderServiceUrl;
    const previewUrl = renderServiceUrl
      ? `${renderServiceUrl}/previews/${activeVersionId}?preview=${signature}`
      : createPreviewUrl(siteDBO, activeVersionId, signature);

    if (!previewUrl) {
      throw error404('Could not generate preview URL');
    }

    return previewUrl;
  },
};
