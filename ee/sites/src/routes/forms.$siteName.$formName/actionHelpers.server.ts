import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { scopes, TrackEvent } from '@curvenote/scms-core';
import {
  userHasSiteScope,
  dbCreateUser,
  dbUpsertLinkedUserLinkedAccount,
  getPrismaClient,
  withContext,
  completeSignupFlow,
  updateSignupStep,
  completeSignupStep,
} from '@curvenote/scms-server';
import type { SiteContext, MyUserDBO, Context } from '@curvenote/scms-server';
import { dbCreateWorkAndSubmission } from './db.server.js';
import { z } from 'zod';
import type { ActionFunctionArgs } from 'react-router';

/**
 * Mark all required signup steps as completed or skipped for form submission
 * This ensures the signup flow can be completed without going through the full signup pages
 */
async function markAllSignupStepsForFormSubmission(
  ctx: Context,
  agreementUrls: string[],
  displayName: string,
  email: string,
) {
  if (!ctx.user) return;

  const signupSteps = ctx.$config.app?.signup?.steps || [];

  // Mark all required steps
  for (const stepConfig of signupSteps) {
    if (stepConfig.type === 'link-providers') {
      // Skip link-providers step (user doesn't need to connect other accounts for form submission)
      await updateSignupStep(
        ctx.user.id,
        'link-providers',
        {
          type: 'link-providers',
          skippedByUser: true,
        },
        true, // Mark as completed
      );
    } else if (stepConfig.type === 'data-collection') {
      // Mark data-collection as completed (form provides name and email)
      await completeSignupStep(ctx.user.id, 'data-collection', {
        type: 'data-collection',
        displayName,
        email,
      });
      // Track event
      await ctx.trackEvent(TrackEvent.SIGNUP_DATA_COLLECTION_COMPLETED, {});
    } else if (stepConfig.type === 'agreement') {
      // Mark agreement as completed (user checked the terms checkbox)
      if (agreementUrls.length > 0) {
        await updateSignupStep(
          ctx.user.id,
          'agreement',
          {
            type: 'agreement',
            accepted: true,
            agreementUrls,
          },
          true, // Mark as completed
        );
        // Track event
        await ctx.trackEvent(TrackEvent.SIGNUP_AGREEMENT_COMPLETED, {
          agreementUrls,
        });
      }
    }
  }

  // Flush analytics after all events
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
  agreedToTerms: zfd.text(z.string().optional()),
});

export async function submitForm(
  ctx: SiteContext,
  user: MyUserDBO | null,
  form: any,
  formData: FormData,
  actionArgs?: ActionFunctionArgs,
) {
  // For logged-in non-pending users, check scope
  if (
    user &&
    !user.pending &&
    !userHasSiteScope(user, scopes.site.submissions.create, ctx.site.id)
  ) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }

  return zfd
    .formData(SubmitFormSchema)
    .parseAsync(Object.fromEntries(formData))
    .then(
      async (dataParsed) => {
        // For non-logged-in users or pending users, require terms acceptance
        const needsTermsAcceptance = !user || user.pending;
        if (needsTermsAcceptance && dataParsed.agreedToTerms !== 'true') {
          return data(
            { error: { message: 'You must accept the terms to submit' } },
            { status: 400 },
          );
        }

        // If user is pending, complete signup steps before submission
        if (user?.pending && actionArgs) {
          const baseCtx = await withContext(actionArgs);
          if (!baseCtx.user || baseCtx.user.id !== user.id) {
            return data({ error: { message: 'User mismatch' } }, { status: 400 });
          }

          // Get agreement URLs from config
          const agreementStep = ctx.$config.app?.signup?.steps?.find(
            (step: { type: string }) => step.type === 'agreement',
          );
          const agreementUrls =
            agreementStep?.agreementUrls?.map((url: { url: string }) => url.url) ?? [];

          // Mark all required signup steps as completed or skipped
          // This ensures the signup flow can be completed without going through signup pages
          await markAllSignupStepsForFormSubmission(
            baseCtx,
            agreementUrls,
            dataParsed.name,
            dataParsed.email,
          );

          // Refresh user in context to get updated signup data before validation
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

          // Complete signup flow (this will mark user as non-pending)
          const signupResult = await completeSignupFlow(baseCtx);
          if (!signupResult.success) {
            return data(
              { error: { message: 'Failed to complete signup. Please try again.' } },
              { status: 400 },
            );
          }

          // Refresh user after signup completion
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
            user = updatedUser as MyUserDBO;
          }
        }

        // Determine collection - use provided one or the single one from form
        let collectionId = dataParsed.collectionId;
        if (!collectionId && form.collections.length === 1) {
          collectionId = form.collections[0].collection.id;
        }
        if (!collectionId) {
          return data({ error: { message: 'Collection is required' } }, { status: 400 });
        }

        // Set authors based on checkbox: empty array if not checked, or [name] if checked
        // Checkbox sends "true" when checked, or is undefined when unchecked
        const isCorrespondingAuthor = dataParsed.isCorrespondingAuthor === 'true';
        const authors = isCorrespondingAuthor ? [dataParsed.name] : [];

        // If no user, create one
        let submitter: MyUserDBO | null = user;
        if (!submitter) {
          const prisma = await getPrismaClient();

          // Check if user with this email already exists
          const existingUser = await prisma.user.findFirst({
            where: { email: dataParsed.email },
            include: {
              linkedAccounts: true,
              site_roles: true,
              work_roles: true,
              roles: { include: { role: true } },
            },
          });

          if (existingUser) {
            // Use existing user
            submitter = existingUser as MyUserDBO;
          } else {
            // Create new user
            const username = dataParsed.email
              .split('@')[0]
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_');
            const newUser = await dbCreateUser({
              email: dataParsed.email,
              username,
              displayName: dataParsed.name,
              primaryProvider: dataParsed.orcid ? 'orcid' : undefined,
              pending: false,
              readyForApproval: false,
            });
            submitter = newUser as MyUserDBO;

            // If ORCID provided, create linked account
            if (dataParsed.orcid) {
              await dbUpsertLinkedUserLinkedAccount('orcid', submitter.id, {
                idAtProvider: dataParsed.orcid,
                email: dataParsed.email,
                profile: {
                  id: dataParsed.orcid,
                  name: dataParsed.name,
                  email: dataParsed.email,
                },
              });
            }
          }
        }

        if (!submitter) {
          return data({ error: { message: 'Unable to create or find user' } }, { status: 500 });
        }

        const result = await dbCreateWorkAndSubmission(ctx, submitter, form, {
          name: dataParsed.name,
          email: dataParsed.email,
          orcid: dataParsed.orcid,
          affiliation: dataParsed.affiliation,
          collectionId,
          workTitle: dataParsed.workTitle,
          workDescription: dataParsed.workDescription,
          authors,
        });

        return { submissionId: result.submissionId, workId: result.workId };
      },
      (error) => {
        return data(
          { error: { message: error.errors?.[0]?.message || 'Invalid form data' } },
          { status: 400 },
        );
      },
    );
}
