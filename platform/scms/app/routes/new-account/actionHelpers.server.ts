import { data as dataResponse } from 'react-router';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import type { Context } from '@curvenote/scms-server';
import {
  validateFormData,
  getPrismaClient,
  updateSignupStep,
  completeSignupFlow,
  completeSignupStep,
} from '@curvenote/scms-server';
import type {
  DataCollectionStepData,
  LinkProvidersStepData,
  UserData,
  GeneralError,
  orcid,
  AuthProvider,
} from '@curvenote/scms-core';
import { TrackEvent } from '@curvenote/scms-core';
import { dbUpsertPendingLinkedAccount } from '../app/settings.linked-accounts/db.server';
import type { OktaProfile } from '@curvenote/remix-auth-okta';
import { uuidv7 } from 'uuidv7';

/**
 * Determines and sets the next step in the user's signup process.
 *
 * This function analyzes the user's current signup progress and determines which step
 * should be completed next based on the configured signup flow. It updates the user's
 * current step in the database to guide them through the signup process.
 *
 * @param ctx - The application context containing user and configuration data
 * @returns The name of the next step to be completed
 */
export async function setNextStep(ctx: Context) {
  const prisma = await getPrismaClient();

  // Fetch the latest user data to get current signup progress
  const latestUserData = await prisma.user.findUnique({
    where: { id: ctx.user!.id },
    select: { data: true },
  });

  if (!latestUserData) {
    throw new Error('User not found');
  }

  // Extract signup data from user's stored data
  const userData = (latestUserData.data as UserData) || {};
  const signupData = userData.signup || {};

  // Get the list of configured signup steps from app configuration
  const configuredStepNames = ctx.$config.app?.signup?.steps?.map((step) => step.type) ?? [];

  // Find the first incomplete step in the configured order
  let nextStepName: string | undefined;
  for (const stepName of configuredStepNames) {
    // Skip completed steps and find the first incomplete one
    if (signupData.steps?.[stepName]?.completed ?? false) {
      continue;
    }
    nextStepName = stepName;
    break;
  }

  // Default to finish-signup if all configured steps are complete
  nextStepName = nextStepName ?? 'finish-signup';

  // Update the user's current step in the database
  await prisma.user.update({
    where: { id: ctx.user!.id },
    data: {
      data: {
        ...userData,
        signup: {
          ...signupData,
          currentStep: nextStepName,
        },
      },
    },
  });

  return nextStepName;
}

/**
 * Completes the agreement step in the signup process.
 *
 * This function marks the agreement step as completed and stores the URLs of the
 * agreements that the user has accepted. It's typically called when a user
 * checks the agreement checkboxes during signup.
 *
 * @param ctx - The application context containing user data
 * @param agreementUrls - Array of URLs for the agreements that were accepted
 * @param accepted - Whether the user accepted the agreements (true) or unaccepted them (false)
 * @returns JSON response indicating success or failure
 */
export async function completeAgreementStep(
  ctx: Context,
  agreementUrls: string[],
  accepted: boolean = true,
) {
  try {
    // Mark the agreement step as completed or incomplete based on acceptance
    await updateSignupStep(
      ctx.user!.id,
      'agreement',
      {
        type: 'agreement',
        accepted,
        agreementUrls,
      },
      accepted, // Mark as completed only if accepted
    );

    if (accepted) {
      await ctx.trackEvent(TrackEvent.SIGNUP_AGREEMENT_COMPLETED, {
        agreementUrls,
      });
      await ctx.analytics.flush();
    }

    return {
      success: true,
      message: `Agreement step ${accepted ? 'completed' : 'unaccepted'} successfully.`,
    };
  } catch (error) {
    // Track signup step failure
    await ctx.trackEvent(TrackEvent.SIGNUP_STEP_FAILED, {
      step: 'agreement',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    await ctx.analytics.flush();

    const generalError: GeneralError = {
      type: 'general',
      message: error instanceof Error ? error.message : 'Failed to complete agreement step',
    };
    return dataResponse({ success: false, error: generalError }, { status: 400 });
  }
}

/**
 * Completes the data collection step in the signup process.
 *
 * This function validates and processes user-provided data (display name and email)
 * during the data collection step. It validates the form data and stores it
 * as part of the user's signup progress.
 *
 * @param ctx - The application context containing user data
 * @param formData - Form data containing displayName and email fields
 * @returns JSON response indicating success or failure
 */
export async function completeDataCollectionStep(ctx: Context, formData: FormData) {
  try {
    // Define validation schema for the data collection form
    const formDataSchema = zfd.formData({
      displayName: zfd.text(z.string().min(1).max(64)),
      email: zfd.text(z.string().email()),
    });
    const validatedFormData = validateFormData(formDataSchema, formData);

    // Create the data collection step data object
    const data: DataCollectionStepData = {
      type: 'data-collection',
      displayName: validatedFormData.displayName,
      email: validatedFormData.email,
    };

    // Mark the data collection step as completed
    await completeSignupStep(ctx.user!.id, 'data-collection', data);

    await ctx.trackEvent(TrackEvent.SIGNUP_DATA_COLLECTION_COMPLETED, {});
    await ctx.analytics.flush();

    return { success: true, message: 'Data collection step completed successfully.' };
  } catch (error) {
    // Track signup step failure
    await ctx.trackEvent(TrackEvent.SIGNUP_STEP_FAILED, {
      step: 'data-collection',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    await ctx.analytics.flush();

    const generalError: GeneralError = {
      type: 'general',
      message: error instanceof Error ? error.message : 'Failed to complete data collection step',
    };
    return dataResponse({ success: false, error: generalError }, { status: 400 });
  }
}

/**
 * Reverts the data collection step to incomplete state, allowing users to edit their details.
 *
 * @param ctx - The application context containing user data
 * @returns JSON response indicating success or failure
 */
export async function revertDataCollectionStep(ctx: Context) {
  try {
    // Mark the data collection step as incomplete
    await updateSignupStep(ctx.user!.id, 'data-collection');
    return { success: true, message: 'Data collection step reverted successfully.' };
  } catch (error) {
    await ctx.trackEvent(TrackEvent.SIGNUP_STEP_FAILED, {
      step: 'data-collection',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    await ctx.analytics.flush();

    const generalError: GeneralError = {
      type: 'general',
      message: error instanceof Error ? error.message : 'Failed to revert data collection step',
    };
    return dataResponse({ success: false, error: generalError }, { status: 400 });
  }
}

/**
 * Updates the link providers step when a user attempts to link a new authentication provider.
 *
 * This function handles the initiation of provider linking by creating a pending linked account
 * and updating the signup step data with the provider being linked and the attempt timestamp.
 * It does not mark the step as complete since the linking process is asynchronous.
 *
 * @param ctx - The application context containing user data
 * @param formData - Form data containing the linkingProvider field
 * @returns JSON response indicating success or failure
 */
export async function updateLinkProvidersStep(ctx: Context, formData: FormData) {
  try {
    const stepData: LinkProvidersStepData = {
      type: 'link-providers',
    };

    // Create validation schema for the linking provider form data
    // Validates that the provider is one of the configured authentication providers
    const formDataSchema = zfd.formData({
      linkingProvider: zfd.text(
        z.enum(Object.keys(ctx.$config.auth ?? {}) as [string, ...string[]]),
      ),
    });
    const validatedFormData = validateFormData(formDataSchema, formData);

    // Extract the provider being linked and update step data
    const linkingProvider = validatedFormData.linkingProvider;
    if (linkingProvider) {
      stepData.linkingProvider = linkingProvider;
      stepData.linkingAttemptedAt = new Date().toISOString();
    }

    // Create a pending linked account record for the provider being linked
    await dbUpsertPendingLinkedAccount(ctx.user!.id, linkingProvider);

    // Update the signup step with linking progress (but don't mark as complete yet)
    await updateSignupStep(
      ctx.user!.id,
      'link-providers',
      stepData,
      false, // Don't mark as complete, just update progress
    );

    return { success: true, message: 'Link providers step updated successfully.' };
  } catch (error) {
    // Track signup step failure
    await ctx.trackEvent(TrackEvent.SIGNUP_STEP_FAILED, {
      step: 'link-providers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    await ctx.analytics.flush();

    const generalError: GeneralError = {
      type: 'general',
      message: error instanceof Error ? error.message : 'Failed to update link providers step',
    };
    return dataResponse({ success: false, error: generalError }, { status: 400 });
  }
}

/**
 * Allows users to skip the link providers step in the signup process.
 *
 * This function marks the link providers step as skipped by the user, which is useful
 * when no additional providers are required or when the user chooses to skip this step.
 * The step is marked as completed when skipped.
 *
 * @param ctx - The application context containing user data
 * @param skip - Boolean indicating whether the user is skipping this step
 * @returns JSON response indicating success or failure
 */
export async function updateSkipLinkProvidersStep(ctx: Context, skip: boolean) {
  try {
    const stepData: LinkProvidersStepData = {
      type: 'link-providers',
      skippedByUser: skip,
    };

    // Update the signup step with skip status
    // If skipping, mark as completed; if not skipping, mark as incomplete
    await updateSignupStep(
      ctx.user!.id,
      'link-providers',
      stepData,
      skip, // Mark as complete if skipped, incomplete if not skipped
    );

    if (skip) {
      await ctx.trackEvent(TrackEvent.SIGNUP_LINK_PROVIDERS_SKIPPED, {});
      await ctx.analytics.flush();
    }

    return { success: true, message: 'Link providers step completed successfully.' };
  } catch (error) {
    // Track signup step failure
    await ctx.trackEvent(TrackEvent.SIGNUP_STEP_FAILED, {
      step: 'link-providers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    await ctx.analytics.flush();

    const generalError: GeneralError = {
      type: 'general',
      message: error instanceof Error ? error.message : 'Failed to complete link providers step',
    };
    return dataResponse({ success: false, error: generalError }, { status: 400 });
  }
}

/**
 * Completes the entire signup process for a user.
 *
 * This function finalizes the signup process by calling the complete signup flow.
 * It handles the final step where all required signup steps have been completed
 * and the user account is fully activated.
 *
 * @param ctx - The application context containing user data
 * @returns Promise containing success status, approval requirements, redirect info, or error
 */
export async function completeSignup(ctx: Context): Promise<{
  success: boolean;
  requiresApproval?: boolean;
  redirectTo?: string;
  error?: GeneralError;
}> {
  try {
    const result = await completeSignupFlow(ctx);
    return result;
  } catch (error) {
    // Track signup completion failure
    await ctx.trackEvent(TrackEvent.SIGNUP_COMPLETION_FAILED, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    await ctx.analytics.flush();

    const generalError: GeneralError = {
      type: 'general',
      message: error instanceof Error ? error.message : 'Failed to complete signup',
    };

    return { success: false, error: generalError };
  }
}

/**
 * Checks and updates the status of linked authentication providers for a user.
 *
 * This function determines which providers are required for linking, checks which ones
 * the user has successfully linked, and updates the signup step completion status accordingly.
 * It also handles cases where no providers are required (skips the step) and enriches
 * user data from linked providers when needed.
 *
 * @param ctx - The application context containing user data and configuration
 */
export async function checkAccountsLinkedStatus(ctx: Context) {
  if (!ctx.user) return;

  const user = ctx.user;

  // Get the list of authentication providers that are configured to allow linking
  const authProviders = ctx.$config.auth;
  const linkableAuthProviders = Object.keys(authProviders ?? {}).filter(
    (provider) => authProviders?.[provider as AuthProvider]?.allowLinking,
  );

  // Get the link-providers step configuration from app config
  const linkProvidersStep = ctx.$config.app?.signup?.steps?.find(
    (step) => step.type === 'link-providers',
  );

  // If no link-providers step is configured, skip this check
  if (!linkProvidersStep || !linkProvidersStep.providers) {
    return;
  }

  // Determine which providers are required (excluding the user's primary provider)
  // and are available to link
  let requiredProviders = linkProvidersStep.providers.filter(
    (provider) => provider !== user.primaryProvider && linkableAuthProviders.includes(provider),
  );

  // Handle special case: Firebase and Google are the same provider
  // If user signed up with Google, don't require them to also link Firebase
  if (linkProvidersStep.providers.includes('firebase') && user.primaryProvider === 'google') {
    requiredProviders = requiredProviders.filter((provider) => provider !== 'firebase');
  }

  // If no required providers, mark the step as skipped and move to next step
  if (requiredProviders.length === 0) {
    // Mark the link-providers step as skipped since no providers are required
    await updateSignupStep(
      ctx.user.id,
      'link-providers',
      {
        type: 'link-providers',
        skippedByUser: true,
      },
      true, // Mark as completed
    );
    // Determine and set the next step in the signup process
    await setNextStep(ctx);
  } else {
    // Get list of providers the user has successfully linked (excluding pending ones)
    const currentLinkedProviders =
      ctx.user.linkedAccounts
        ?.filter((account) => !account.pending)
        .map((account) => account.provider) || [];

    // Check if user has linked ALL required providers
    const hasAllRequiredProviders = requiredProviders.every((requiredProvider) =>
      currentLinkedProviders.includes(requiredProvider),
    );

    // Retrieve current signup step data to check completion status
    const userData = (ctx.user.data ?? {}) as UserData;
    const signupData = userData.signup ?? {};
    const linkProvidersStepData = signupData.steps?.['link-providers'] as
      | LinkProvidersStepData
      | undefined;
    const dataCollectionStepData = signupData.steps?.['data-collection'] as
      | DataCollectionStepData
      | undefined;

    const isCurrentlyCompleted = linkProvidersStepData?.completed ?? false;

    // Only update the step completion status if it has actually changed
    // This prevents unnecessary database writes and potential race conditions
    if (hasAllRequiredProviders !== isCurrentlyCompleted) {
      const updatedStepData: LinkProvidersStepData = {
        type: 'link-providers',
        ...linkProvidersStepData, // Preserve any existing step data
        completed: hasAllRequiredProviders,
      };

      // Update the signup step in the database
      await updateSignupStep(
        ctx.user.id,
        'link-providers',
        updatedStepData,
        hasAllRequiredProviders,
      );

      if (hasAllRequiredProviders) {
        await ctx.trackEvent(TrackEvent.SIGNUP_LINK_PROVIDERS_COMPLETED, {
          linkedProviders: currentLinkedProviders,
          requiredProviders,
        });
        await ctx.analytics.flush();
      }
    }

    // Enrich user data from linked providers if any data is missing
    await enrichUserObject(ctx, linkProvidersStepData, dataCollectionStepData);

    // Determine and set the next step in the signup process
    await setNextStep(ctx);
  }
}

/**
 * Enriches the user object with missing data from linked authentication providers.
 *
 * This function checks if the user is missing essential data (email, username, display_name)
 * and attempts to populate it from their linked authentication providers (ORCID or Okta).
 * It only updates missing fields and respects the data collection step completion status.
 *
 * @param user - The current user object from context
 * @param linkProvidersStepData - Data about the link providers step completion status
 * @param dataCollectionStepData - Data about the data collection step completion status
 */
async function enrichUserObject(
  ctx: Context,
  linkProvidersStepData: LinkProvidersStepData | undefined,
  dataCollectionStepData: DataCollectionStepData | undefined,
) {
  const user = ctx.user;
  if (!user) return;

  // Extract the provider currently being linked and data collection completion status
  const currentProviderBeingLinked = linkProvidersStepData?.linkingProvider;
  const isDataCollectionStepCompleted = dataCollectionStepData?.completed ?? false;

  // Check if user is missing any essential data fields
  const userIsMissingData =
    user.email === null || user.username === null || user.display_name === null;

  // Only proceed if user is missing data and we have a valid provider to extract data from
  const prisma = await getPrismaClient();
  if (userIsMissingData) {
    if (currentProviderBeingLinked === 'orcid' || currentProviderBeingLinked === 'okta') {
      // Initialize object to hold data extracted from the authentication provider
      let providerData: { email?: string; display_name?: string; username?: string } = {};

      // Extract data from ORCID provider
      if (currentProviderBeingLinked === 'orcid') {
        const orcidAccount = user.linkedAccounts?.find((account) => account.provider === 'orcid');
        if (orcidAccount) {
          const orcidProfile = orcidAccount?.profile as unknown as orcid.ORCIDProfile;
          const name = orcidProfile?.name;
          providerData = {
            email: orcidAccount.email ?? undefined,
            display_name: name,
            // Generate username from ORCID name with random suffix for uniqueness
            username: name
              ? orcidProfile?.name.toLowerCase().replace(/ /g, '_') + '_' + uuidv7().substring(0, 6)
              : undefined,
          };
        }
      }

      // Extract data from Okta provider
      if (currentProviderBeingLinked === 'okta') {
        const oktaAccount = user.linkedAccounts?.find((account) => account.provider === 'okta');

        if (oktaAccount) {
          const oktaProfile = oktaAccount?.profile as unknown as OktaProfile;
          providerData = {
            email: oktaAccount.email ?? undefined,
            display_name: oktaProfile?.name,
            username: oktaProfile?.preferred_username,
          };
        }
      }

      // Start with current user data as base for updates
      const data = {
        display_name: user.display_name,
        email: user.email,
        username: user.username,
      };

      // Only update email and display_name if data collection step is not completed
      // This prevents overwriting user-provided data during the data collection step
      if (!isDataCollectionStepCompleted) {
        console.log('isDataCollectionStepCompleted', isDataCollectionStepCompleted);
        if (user.email == null && providerData.email) {
          data.email = providerData.email;
        }
        if (user.display_name == null && providerData.display_name) {
          data.display_name = providerData.display_name;
        }
      }

      // Username can always be updated from provider data if missing
      if (user.username == null && providerData.username) {
        data.username = providerData.username;
      }

      // Update user object in database with enriched data
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data,
      });

      await ctx.identifyEvent(updatedUser ?? undefined);
    }
  }
}
