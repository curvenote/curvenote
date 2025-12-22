import type { LoaderFunctionArgs } from 'react-router';
import { redirect, data } from 'react-router';
import { error404, error403, TrackEvent } from '@curvenote/scms-core';
import {
  withContext,
  getMagicLink,
  validateAndLogAccess,
  logAccess,
  getHandler,
  getPrismaClient,
  baseMagicLinkHandlers,
} from '@curvenote/scms-server';

/**
 * GET /v1/magic/:linkId - Magic link access endpoint
 *
 * This endpoint handles magic link access using a type-based handler registry.
 * It validates the magic link, logs the access attempt, and delegates to the
 * appropriate handler based on the link type.
 *
 * Query Parameters:
 * - format=json: Return JSON metadata instead of redirecting (for programmatic access)
 *
 * Flow:
 * 1. Look up magic link by ID
 * 2. Validate link (not expired, not revoked, under access limit)
 * 3. Look up handler for the magic link type
 * 4. Delegate to handler to get redirect URL
 * 5. Log access attempt (with IP, user agent, success/failure)
 * 6a. If format=json: Return JSON with link metadata and target URL
 * 6b. Otherwise: Redirect to URL provided by handler
 * 7. If invalid: Return 403/404 with error message
 */
export async function loader(args: LoaderFunctionArgs) {
  const ctx = await withContext(args);
  const linkId = args.params.linkId;

  if (!linkId) {
    throw error404('Magic link not found');
  }

  // Check if JSON format is requested
  const url = new URL(args.request.url);
  const format = url.searchParams.get('format');
  const isJsonFormat = format?.toLowerCase() === 'json';

  // Extract IP address and user agent for logging
  const ipAddress =
    args.request.headers.get('x-forwarded-for') ||
    args.request.headers.get('x-real-ip') ||
    undefined;
  const userAgent = args.request.headers.get('user-agent') || undefined;

  // Track whether we have a valid magic link for logging purposes
  let magicLink: Awaited<ReturnType<typeof getMagicLink>> = null;

  try {
    // Look up the magic link
    magicLink = await getMagicLink(linkId);

    if (!magicLink) {
      // Track failed access attempt for non-existent link
      try {
        await ctx.trackEvent(
          TrackEvent.MAGIC_LINK_ACCESS_FAILED,
          {
            linkId,
            reason: 'Link not found',
          },
          { anonymous: true },
        );
      } catch (trackError) {
        // If tracking fails, log to console but don't fail the request
        console.error('Failed to track magic link access failure:', trackError);
      }
      throw error404('This link does not exist or has been removed');
    }

    // Get handler for this magic link type (check before atomic validation)
    // This allows us to fail fast with appropriate error if handler doesn't exist
    const handler = getHandler(magicLink.type, baseMagicLinkHandlers);

    if (!handler) {
      const reason = `Unknown magic link type: ${magicLink.type}`;
      // Log failed access attempt (handler doesn't exist)
      await logAccess(linkId, {
        ipAddress,
        userAgent,
        success: false,
        errorMessage: reason,
      });
      // Track failed access attempt
      try {
        await ctx.trackEvent(
          TrackEvent.MAGIC_LINK_ACCESS_FAILED,
          {
            linkId,
            linkType: magicLink.type,
            reason,
          },
          { anonymous: !ctx.user },
        );
      } catch (trackError) {
        console.error('Failed to track magic link access failure:', trackError);
      }
      throw error404('This link type is not supported');
    }

    // Atomically validate the magic link and log access
    // This prevents race conditions when checking access limits
    const validation = await validateAndLogAccess(linkId, {
      ipAddress,
      userAgent,
      success: true, // Will be set to false if validation fails
    });

    if (!validation.valid) {
      const reason = validation.reason || 'This link is no longer valid';
      // Access log already created by validateAndLogAccess
      // Track failed access attempt
      try {
        await ctx.trackEvent(
          TrackEvent.MAGIC_LINK_ACCESS_FAILED,
          {
            linkId,
            linkType: magicLink.type,
            reason,
          },
          { anonymous: !ctx.user },
        );
      } catch (trackError) {
        console.error('Failed to track magic link access failure:', trackError);
      }
      throw error403(reason);
    }

    // Delegate to the appropriate handler to get redirect URL
    const redirectUrl = await handler.handle(magicLink, ctx, {
      ipAddress,
      userAgent,
    });

    // Access already logged as successful by validateAndLogAccess

    // Track successful access
    try {
      const linkData = magicLink.data as { submissionId?: string; siteName?: string };
      await ctx.trackEvent(
        TrackEvent.MAGIC_LINK_ACCESSED,
        {
          linkId,
          linkType: magicLink.type,
          submissionId: linkData.submissionId,
          siteName: linkData.siteName,
          format: isJsonFormat ? 'json' : 'redirect',
        },
        { anonymous: !ctx.user },
      );
    } catch (trackError) {
      console.error('Failed to track magic link access:', trackError);
    }

    // Return JSON format if requested (for programmatic consumption)
    if (isJsonFormat) {
      // Get creator information (without exposing user ID)
      const prisma = await getPrismaClient();
      const creator = await prisma.user.findUnique({
        where: { id: magicLink.created_by_id },
        select: {
          display_name: true,
          email: true,
        },
      });

      return data({
        link: {
          id: magicLink.id,
          type: magicLink.type,
          created: magicLink.date_created,
          created_by: creator
            ? {
                name: creator.display_name,
                email: creator.email,
              }
            : null,
          expires: magicLink.expiry,
          revoked: magicLink.revoked,
          access_limit: magicLink.access_limit,
          url: url.origin + url.pathname,
        },
        target: {
          url: redirectUrl,
        },
      });
    }

    // Default behavior: Redirect to the URL provided by the handler
    return redirect(redirectUrl);
  } catch (error) {
    // If it's already an HTTP error, rethrow it
    if (error instanceof Response) {
      throw error;
    }

    // Log unexpected errors only if we have a valid magic link
    // (cannot log access for non-existent links due to foreign key constraint)
    console.error('Magic link error:', error);
    if (magicLink) {
      try {
        await logAccess(linkId, {
          ipAddress,
          userAgent,
          success: false,
          errorMessage: 'Internal error',
        });
        // Track failed access attempt
        await ctx.trackEvent(
          TrackEvent.MAGIC_LINK_ACCESS_FAILED,
          {
            linkId,
            linkType: magicLink.type,
            reason: 'Internal error',
          },
          { anonymous: !ctx.user },
        );
      } catch (logError) {
        // If logging fails, log to console but don't fail the request
        console.error('Failed to log magic link access:', logError);
      }
    }

    throw error404('An error occurred while processing this link');
  }
}
