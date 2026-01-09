import { data } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import type { SiteContext, MagicLinkData } from '@curvenote/scms-server';
import {
  createMagicLink,
  revokeMagicLink,
  reactivateMagicLink,
  deleteMagicLink,
  getMagicLinksForSubmission,
  getMagicLink,
} from '@curvenote/scms-server';
import { TrackEvent, formatZodError } from '@curvenote/scms-core';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

// Zod schemas for magic link form validation
const CreateMagicLinkSchema = zfd.formData({
  name: zfd
    .text(z.string().optional())
    .transform((val) => {
      // Transform empty string to undefined for optional field
      return val && val.trim() !== '' ? val.trim() : undefined;
    })
    .pipe(z.string().optional()),
  email: zfd
    .text(z.string().optional())
    .transform((val) => {
      // Transform empty string to undefined for optional field
      return val && val.trim() !== '' ? val.trim() : undefined;
    })
    .pipe(z.string().email('Invalid email address').optional()),
  expiryDuration: zfd
    .text(z.string().optional())
    .transform((val) => {
      if (!val || val === '' || val === '0') return undefined;
      const num = parseInt(val, 10);
      return isNaN(num) ? undefined : num;
    })
    .pipe(z.number().int().min(0, 'Expiry duration must be non-negative').optional()),
  accessLimit: zfd
    .text(z.string().optional())
    .transform((val) => {
      // Treat empty string as undefined (no limit)
      if (!val || val === '') return undefined;
      const num = parseInt(val, 10);
      // Return undefined for invalid numbers (treated as no limit)
      if (isNaN(num)) return undefined;
      // Return the number as-is (including 0) so .min(1) can reject invalid values
      // This ensures that 0 is explicitly rejected by the .min(1) validation
      return num;
    })
    .pipe(
      z
        .union([
          z.undefined(),
          z.number().int().min(1, 'Access limit must be a positive integer (1 or greater)'),
        ])
        .optional(),
    ),
});

const MagicLinkActionSchema = zfd.formData({
  linkId: zfd.text(z.string().uuid('Invalid link ID')),
});

/**
 * Verifies that a magic link belongs to the specified submission and site
 */
async function verifyMagicLinkOwnership(
  linkId: string,
  submissionId: string,
  siteName: string,
): Promise<{ valid: boolean; error?: string }> {
  const magicLink = await getMagicLink(linkId);

  if (!magicLink) {
    return { valid: false, error: 'Magic link not found' };
  }

  const linkData = magicLink.data as MagicLinkData;

  if (linkData.submissionId !== submissionId) {
    return { valid: false, error: 'Magic link does not belong to this submission' };
  }

  if (linkData.siteName !== siteName) {
    return { valid: false, error: 'Magic link does not belong to this site' };
  }

  return { valid: true };
}

export async function actionCreateMagicLink(
  ctx: SiteContext,
  args: ActionFunctionArgs,
  formData: FormData,
) {
  const { submissionId } = args.params;

  if (!submissionId) {
    return data({ error: 'Missing submissionId' }, { status: 400 });
  }

  if (!ctx.user) {
    return data({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate form data with Zod
  let payload;
  try {
    payload = CreateMagicLinkSchema.parse(formData);
  } catch (e: any) {
    console.error('Invalid form data:', e);
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { name, email, expiryDuration, accessLimit } = payload;

  try {
    const magicLinkData: MagicLinkData = {
      submissionId,
      siteName: ctx.site.name,
    };

    // Schema already handles trimming and empty string to undefined conversion
    if (email) {
      magicLinkData.email = email;
    }
    if (name) {
      magicLinkData.name = name;
    }

    const magicLink = await createMagicLink({
      type: 'submission_preview',
      data: magicLinkData,
      createdById: ctx.user.id,
      expiryDuration: expiryDuration && expiryDuration > 0 ? expiryDuration : undefined,
      accessLimit,
    });

    // Track magic link creation
    try {
      await ctx.trackEvent(TrackEvent.MAGIC_LINK_CREATED, {
        linkId: magicLink.id,
        linkType: magicLink.type,
        submissionId,
        siteName: ctx.site.name,
        hasExpiry: !!magicLink.expiry,
        hasAccessLimit: magicLink.access_limit !== null,
      });
    } catch (trackError) {
      console.error('Failed to track magic link creation:', trackError);
    }

    return data({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error creating magic link:', error);
    return data({ error: 'Failed to create magic link' }, { status: 500 });
  }
}

export async function actionRevokeMagicLink(
  ctx: SiteContext,
  args: ActionFunctionArgs,
  formData: FormData,
) {
  const { submissionId } = args.params;

  if (!submissionId) {
    return data({ error: 'Missing submissionId' }, { status: 400 });
  }

  if (!ctx.user) {
    return data({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate form data with Zod
  let payload;
  try {
    payload = MagicLinkActionSchema.parse(formData);
  } catch (e: any) {
    console.error('Invalid form data:', e);
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { linkId } = payload;

  try {
    // Verify the magic link belongs to this submission and site
    const verification = await verifyMagicLinkOwnership(linkId, submissionId, ctx.site.name);
    if (!verification.valid) {
      return data({ error: verification.error || 'Unauthorized' }, { status: 403 });
    }

    await revokeMagicLink(linkId);

    // Track magic link revocation
    try {
      const magicLink = await getMagicLink(linkId);
      if (magicLink) {
        await ctx.trackEvent(TrackEvent.MAGIC_LINK_REVOKED, {
          linkId,
          linkType: magicLink.type,
          submissionId,
          siteName: ctx.site.name,
        });
      }
    } catch (trackError) {
      console.error('Failed to track magic link revocation:', trackError);
    }

    return data({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error revoking magic link:', error);
    return data({ error: 'Failed to revoke magic link' }, { status: 500 });
  }
}

export async function actionReactivateMagicLink(
  ctx: SiteContext,
  args: ActionFunctionArgs,
  formData: FormData,
) {
  const { submissionId } = args.params;

  if (!submissionId) {
    return data({ error: 'Missing submissionId' }, { status: 400 });
  }

  if (!ctx.user) {
    return data({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate form data with Zod
  let payload;
  try {
    payload = MagicLinkActionSchema.parse(formData);
  } catch (e: any) {
    console.error('Invalid form data:', e);
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { linkId } = payload;

  try {
    // Verify the magic link belongs to this submission and site
    const verification = await verifyMagicLinkOwnership(linkId, submissionId, ctx.site.name);
    if (!verification.valid) {
      return data({ error: verification.error || 'Unauthorized' }, { status: 403 });
    }

    await reactivateMagicLink(linkId);

    // Track magic link reactivation
    try {
      const magicLink = await getMagicLink(linkId);
      if (magicLink) {
        await ctx.trackEvent(TrackEvent.MAGIC_LINK_REACTIVATED, {
          linkId,
          linkType: magicLink.type,
          submissionId,
          siteName: ctx.site.name,
        });
      }
    } catch (trackError) {
      console.error('Failed to track magic link reactivation:', trackError);
    }

    return data({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error reactivating magic link:', error);
    return data({ error: 'Failed to reactivate magic link' }, { status: 500 });
  }
}

export async function actionDeleteMagicLink(
  ctx: SiteContext,
  args: ActionFunctionArgs,
  formData: FormData,
) {
  const { submissionId } = args.params;

  if (!submissionId) {
    return data({ error: 'Missing submissionId' }, { status: 400 });
  }

  if (!ctx.user) {
    return data({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate form data with Zod
  let payload;
  try {
    payload = MagicLinkActionSchema.parse(formData);
  } catch (e: any) {
    console.error('Invalid form data:', e);
    return data({ error: formatZodError(e) }, { status: 400 });
  }

  const { linkId } = payload;

  try {
    // Verify the magic link belongs to this submission and site
    const verification = await verifyMagicLinkOwnership(linkId, submissionId, ctx.site.name);
    if (!verification.valid) {
      return data({ error: verification.error || 'Unauthorized' }, { status: 403 });
    }

    // Get magic link info before deletion for tracking
    const magicLink = await getMagicLink(linkId);
    const linkType = magicLink?.type;

    await deleteMagicLink(linkId);

    // Track magic link deletion
    try {
      if (magicLink) {
        await ctx.trackEvent(TrackEvent.MAGIC_LINK_DELETED, {
          linkId,
          linkType: linkType || 'unknown',
          submissionId,
          siteName: ctx.site.name,
        });
      }
    } catch (trackError) {
      console.error('Failed to track magic link deletion:', trackError);
    }

    return data({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting magic link:', error);
    return data({ error: 'Failed to delete magic link' }, { status: 500 });
  }
}

export async function loadMagicLinks(submissionId: string) {
  return getMagicLinksForSubmission(submissionId);
}
