import { data } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { zfd } from 'zod-form-data';
import { TrackEvent } from '@curvenote/scms-core';
import {
  getPrismaClient,
  withContext,
  completeSignupFlow,
  updateSignupStep,
  completeSignupStep,
} from '@curvenote/scms-server';
import type { SiteContext, MyUserDBO, Context } from '@curvenote/scms-server';
import { dbCreateWorkAndSubmission } from './db.server.js';
import { z } from 'zod';

/**
 * Mark all required signup steps as completed or skipped for form submission
 * (from forms route – form handles new account info, no pending user page visit)
 */
async function markAllSignupStepsForFormSubmission(
  ctx: Context,
  agreementUrls: string[],
  displayName: string,
  email: string,
) {
  if (!ctx.user) return;

  const signupSteps = ctx.$config.app?.signup?.steps || [];

  for (const stepConfig of signupSteps) {
    if (stepConfig.type === 'link-providers') {
      await updateSignupStep(
        ctx.user.id,
        'link-providers',
        { type: 'link-providers', skippedByUser: true },
        true,
      );
    } else if (stepConfig.type === 'data-collection') {
      await completeSignupStep(ctx.user.id, 'data-collection', {
        type: 'data-collection',
        displayName,
        email,
      });
      await ctx.trackEvent(TrackEvent.SIGNUP_DATA_COLLECTION_COMPLETED, {});
    } else if (stepConfig.type === 'agreement') {
      if (agreementUrls.length > 0) {
        await updateSignupStep(
          ctx.user.id,
          'agreement',
          { type: 'agreement', accepted: true, agreementUrls },
          true,
        );
        await ctx.trackEvent(TrackEvent.SIGNUP_AGREEMENT_COMPLETED, { agreementUrls });
      }
    }
  }

  await ctx.analytics.flush();
}

const SubmitFormSchema = zfd.formData({
  name: zfd.text(z.string().min(1)),
  email: zfd.text(z.string().email()),
  orcid: zfd.text(z.string().optional()),
  affiliation: zfd.text(z.string().optional()),
  collectionId: zfd.text(z.string().uuid()).optional(),
  workTitle: zfd.text(z.string().min(1)),
  workDescription: zfd.text(z.string().optional()),
  isCorrespondingAuthor: zfd.text(z.string().optional()),
  authors: zfd.text(z.string().optional()),
  agreedToTerms: zfd.text(z.string().optional()),
  /** JSON string of form-defined fields (keywords, format, license, etc.) for work version metadata. */
  formMetadata: zfd.text(z.string().optional()),
});

export async function submitForm(
  ctx: SiteContext,
  user: MyUserDBO | null,
  form: any,
  formData: FormData,
  actionArgs?: ActionFunctionArgs,
) {
  return zfd
    .formData(SubmitFormSchema)
    .parseAsync(Object.fromEntries(formData))
    .then(
      async (dataParsed) => {
        if (!user) {
          return data(
            { error: { message: 'Please sign in (e.g. ORCID/Google) before submitting.' } },
            { status: 400 },
          );
        }

        const needsTermsAcceptance = user.pending;
        if (needsTermsAcceptance && dataParsed.agreedToTerms !== 'true') {
          return data(
            { error: { message: 'You must accept the terms to submit' } },
            { status: 400 },
          );
        }

        let submitter: MyUserDBO = user;
        if (user.pending && actionArgs) {
          const baseCtx = await withContext(actionArgs);
          if (!baseCtx.user || baseCtx.user.id !== user.id) {
            return data({ error: { message: 'User mismatch' } }, { status: 400 });
          }

          const agreementStep = ctx.$config.app?.signup?.steps?.find(
            (step: { type: string }) => step.type === 'agreement',
          );
          const agreementUrls =
            agreementStep?.agreementUrls?.map((url: { url: string }) => url.url) ?? [];

          await markAllSignupStepsForFormSubmission(
            baseCtx,
            agreementUrls,
            dataParsed.name,
            dataParsed.email,
          );

          const prisma = await getPrismaClient();
          const refreshedUser = await prisma.user.findUnique({
            where: { id: baseCtx.user!.id },
            include: {
              linkedAccounts: true,
              site_roles: true,
              work_roles: true,
              roles: { include: { role: true } },
            },
          });
          if (refreshedUser) {
            baseCtx.user = { ...(refreshedUser as MyUserDBO), email_verified: true };
          }

          const signupResult = await completeSignupFlow(baseCtx);
          if (!signupResult.success) {
            return data(
              { error: { message: 'Failed to complete signup. Please try again.' } },
              { status: 400 },
            );
          }

          const updatedUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
              linkedAccounts: true,
              site_roles: true,
              work_roles: true,
              roles: { include: { role: true } },
            },
          });
          if (updatedUser) {
            submitter = updatedUser as MyUserDBO;
          }
        }

        let collectionId = dataParsed.collectionId;
        if (!collectionId && form.collections?.length === 1) {
          collectionId = form.collections[0].collection.id;
        }
        if (!collectionId) {
          return data({ error: { message: 'Collection is required' } }, { status: 400 });
        }

        let authors: string[];
        if (dataParsed.authors) {
          try {
            const parsed = JSON.parse(dataParsed.authors) as unknown;
            authors = Array.isArray(parsed)
              ? parsed.filter((a): a is string => typeof a === 'string')
              : [];
          } catch {
            authors = [];
          }
        } else {
          const isCorrespondingAuthor = dataParsed.isCorrespondingAuthor === 'true';
          authors = isCorrespondingAuthor ? [dataParsed.name] : [];
        }

        let formMetadata: Record<string, unknown> = {};
        if (dataParsed.formMetadata?.trim()) {
          try {
            formMetadata = JSON.parse(dataParsed.formMetadata) as Record<string, unknown>;
          } catch {
            // ignore invalid JSON
          }
        }

        const draftObjectId = (formData.get('objectId') as string | null) || null;
        const result = await dbCreateWorkAndSubmission(
          ctx,
          submitter,
          form,
          {
            name: dataParsed.name,
            email: dataParsed.email,
            orcid: dataParsed.orcid,
            affiliation: dataParsed.affiliation,
            collectionId,
            workTitle: dataParsed.workTitle,
            workDescription: dataParsed.workDescription,
            authors,
            formMetadata,
          },
          draftObjectId,
        );

        return { submissionId: result.submissionId, workId: result.workId };
      },
      (error: { issues?: Array<{ message?: string }> }) => {
        const message = error?.issues?.[0]?.message ?? 'Invalid form data';
        return data({ error: { message } }, { status: 400 });
      },
    );
}
