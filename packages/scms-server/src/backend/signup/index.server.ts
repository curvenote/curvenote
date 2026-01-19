import type { Config as AppConfig } from '@/types/app-config.js';
import { getPrismaClient } from '../prisma.server.js';
import { validateAllSignupSteps } from './validators.server.js';
import type {
  SigninSignupConfig,
  SignupData,
  SignupStepData,
  DataCollectionStepData,
  UserData,
  AuthProvider,
} from '@curvenote/scms-core';
import { KnownResendEvents, TrackEvent } from '@curvenote/scms-core';
import type { Context } from '../context.server.js';
import type { User } from '@curvenote/scms-db';

/**
 * Load and validate signin/signup configuration from app config
 */
export function loadAndValidateSigninSignupConfig(deploymentConfig: AppConfig): SigninSignupConfig {
  const { signin, signup } = (deploymentConfig.app ?? {}) as SigninSignupConfig;
  const signinSignUpConfig: SigninSignupConfig = { signin, signup };

  // Validate configuration
  const enabledProviderNames = deploymentConfig.auth ? Object.keys(deploymentConfig.auth) : [];
  validateSigninSignupConfig(signinSignUpConfig, enabledProviderNames, deploymentConfig.auth);

  return signinSignUpConfig;
}

/**
 * Complete the signup flow for a user and determine next steps based on approval configuration
 *
 * This function handles the final stage of user registration after they have completed all signup steps.
 * It evaluates approval requirements and either grants immediate access or queues the user for manual approval.
 *
 * **Approval Logic:**
 * 1. If manual approval is disabled globally (`signinSignupConfig.signup.approval.manual = false`),
 *    the user is immediately activated and granted access
 * 2. If the user's signup provider is in the skip approval list (`signinSignupConfig.signup.approval.skipApproval`),
 *    they are granted immediate access with a "trusted_provider" skip reason
 * 3. Otherwise, the user is marked as ready for manual approval and must wait for admin approval
 *
 * **Database Updates:**
 * - Sets `pending: false` for users granted immediate access
 * - Sets `ready_for_approval: true` for users requiring approval
 * - Updates `date_modified` with current timestamp
 * - Enriches `signup_data` with completion status and metadata
 *
 * @param userId - The UUID of the user completing signup
 * @param signinSignupConfig - Authentication configuration containing approval settings
 *
 * @returns Promise resolving to an object containing:
 *   - `requiresApproval`: boolean indicating if manual approval is needed
 *   - `redirectTo`: optional URL path where the user should be redirected
 *     - `/app` for users granted immediate access
 *     - `/awaiting-approval` for users requiring approval
 *     - `undefined` for already completed users (redirects to `/app`)
 *
 * @throws {Error} if the user is not found in the database
 *
 * @example
 * ```typescript
 * // User with trusted provider - immediate access
 * const result = await completeSignupFlow('user-123', authConfig);
 * // result: { requiresApproval: false, redirectTo: '/app' }
 *
 * // User requiring approval
 * const result = await completeSignupFlow('user-456', authConfig);
 * // result: { requiresApproval: true, redirectTo: '/awaiting-approval' }
 * ```
 */
export async function completeSignupFlow(
  ctx: Context,
): Promise<{ success: boolean; requiresApproval?: boolean; redirectTo?: string }> {
  const user = ctx.user!;
  const signinSignupConfig = loadAndValidateSigninSignupConfig(ctx.$config);
  const prisma = await getPrismaClient();

  if (!user.pending) {
    // User is already complete, redirect to app
    return { success: true, requiresApproval: false, redirectTo: '/app' };
  }

  // ✨ Validate all signup steps are completed
  const userData = (user.data as UserData) || {};
  const signupData = userData.signup || {};
  const requiredSteps = signinSignupConfig.signup?.steps || [];

  const validation = await validateAllSignupSteps(user, signupData, requiredSteps);
  if (!validation.isValid) {
    throw new Error(`Signup validation failed: ${validation.errors.join('; ')}`);
  }

  // Determine approval requirements before database update
  const dataCollectionStep = signupData.steps?.['data-collection'] as DataCollectionStepData;
  let signupProvider = [
    user.primaryProvider,
    ...(user.linkedAccounts?.map((account) => account.provider) || []),
  ];

  // HACK: handle firebase / google name collision
  if (
    signinSignupConfig.signup?.approval?.skipApproval?.includes('firebase') &&
    signupProvider.includes('google')
  ) {
    signupProvider = signupProvider.map((p) => (p === 'google' ? 'firebase' : p));
  }

  // Check if manual approval can be skipped
  const skipManualApproval =
    !signinSignupConfig.signup?.approval?.manual ||
    (signupProvider &&
      signinSignupConfig.signup?.approval?.skipApproval?.some((p) => signupProvider.includes(p)));

  const timestamp = new Date().toISOString();

  if (skipManualApproval) {
    // Immediate access - no approval required
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        pending: false,
        ready_for_approval: false,
        date_modified: timestamp,
        display_name: dataCollectionStep?.displayName,
        email: dataCollectionStep?.email,
        data: {
          ...((user.data as UserData) || {}),
          signup: {
            ...((userData.signup as SignupData) || {}),
            completedAt: timestamp,
            status: 'completed',
            skipReason: 'trusted_provider',
          },
        },
      },
    });

    await ctx.identifyEvent(updatedUser);

    await ctx.trackEvent(TrackEvent.USER_APPROVED, {
      skipReason: 'trusted_provider',
      signupProvider: signupProvider.join(','),
    });

    // Send welcome email to users who don't need approval
    if (updatedUser.email) {
      await ctx.sendEmail({
        eventType: KnownResendEvents.USER_WELCOME,
        to: updatedUser.email,
        subject: 'Welcome!',
        templateProps: {
          approval: false,
        },
      });
    }

    return { success: true, requiresApproval: false, redirectTo: '/app' };
  }
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      ready_for_approval: true,
      date_modified: timestamp,
      display_name: dataCollectionStep?.displayName,
      email: dataCollectionStep?.email,
      data: {
        ...((user.data as UserData) || {}),
        signup: {
          ...((userData.signup as SignupData) || {}),
          completedAt: timestamp,
          status: 'awaiting_approval',
        },
      },
    },
  });

  await ctx.identifyEvent(updatedUser);

  await ctx.trackEvent(TrackEvent.USER_READY_FOR_APPROVAL, {
    signupProvider: signupProvider.join(','),
  });

  // Send email notifications to admins about the approval request
  await sendAdminApprovalNotifications(ctx, updatedUser);
  return { success: true, requiresApproval: true, redirectTo: '/awaiting-approval' };
}

/**
 * Send email notifications to admin users when a new user requires approval
 */
async function sendAdminApprovalNotifications(ctx: Context, user: User) {
  try {
    const adminEmail = ctx.$config.app?.branding?.supportEmail;
    if (!adminEmail) {
      throw new Error('Support email is not configured');
    }
    const userDisplayName = user.display_name || 'Unknown User';
    const userEmail = user.email || 'No email provided';
    const userProvider = user.primaryProvider || 'Unknown Provider';

    await ctx.sendEmail({
      eventType: KnownResendEvents.USER_APPROVAL_REQUESTED,
      to: adminEmail,
      subject: `New User Approval Request: ${userDisplayName}`,
      ignoreUnsubscribe: true,
      templateProps: {
        userDisplayName,
        userEmail,
        userProvider,
      },
    });

    console.log(
      `Sent approval request notifications to ${adminEmail} for user: ${userDisplayName}`,
    );
  } catch (error) {
    // Don't throw - we don't want email failures to break the signup flow
    console.error('Failed to send admin approval notifications:', error);
  }
}

/**
 * Update signup step progress for a user
 */
export async function updateSignupStep(
  userId: string,
  stepType: string,
  stepData?: Partial<SignupStepData>,
  completed?: boolean,
): Promise<void> {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();

  // Get current user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { data: true },
  });

  const currentUserData = (user?.data as UserData) || {};
  const currentSignupData = currentUserData.signup || {};

  await prisma.user.update({
    where: { id: userId },
    data: {
      date_modified: timestamp,
      data: {
        ...currentUserData,
        signup: {
          ...currentSignupData,
          lastUpdated: timestamp,
          steps: {
            ...currentSignupData.steps,
            [stepType]: {
              completedAt: completed ? timestamp : undefined,
              completed: completed ?? false,
              ...stepData,
            },
          },
        },
      },
    },
  });
}

/**
 * Complete signup step for user
 */
export async function completeSignupStep(
  userId: string,
  stepType: string,
  stepData: DataCollectionStepData,
) {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { data: true },
  });
  const currentUserData = (user?.data as UserData) || {};
  const currentSignupData = currentUserData.signup || {};

  await prisma.user.update({
    where: { id: userId },
    data: {
      data: {
        ...currentUserData,
        signup: {
          ...currentSignupData,
          steps: {
            ...currentSignupData.steps,
            [stepType]: {
              ...currentSignupData.steps?.[stepType],
              completedAt: timestamp,
              completed: true,
              ...stepData,
            },
          },
        },
      },
    },
  });
}

/**
 * Validate authentication configuration
 *
 * @throws {Error} if the configuration is invalid, as configuration should be validated at deploy time
 */
function validateSigninSignupConfig(
  config: SigninSignupConfig,
  enabledProviders: string[],
  authConfig: AppConfig['auth'],
): void {
  // Validate signin preferred provider
  if (config?.signin?.mode === 'preferred') {
    if (!config.signin.preferred) {
      throw new Error(
        'Configuration error - signin.preferred is required when signin.mode is "preferred"',
      );
    } else if (!enabledProviders.includes(config.signin.preferred)) {
      throw new Error(
        `Configuration error - signin.preferred provider "${config.signin.preferred}" is not enabled`,
      );
    }
  }

  // Validate signup preferred provider
  if (config?.signup?.mode === 'preferred') {
    if (!config.signup.preferred) {
      throw new Error(
        'Configuration error - signup.preferred is required when signup.mode is "preferred"',
      );
    } else if (!enabledProviders.includes(config.signup.preferred)) {
      throw new Error(
        `Configuration error - signup.preferred provider "${config.signup.preferred}" is not enabled`,
      );
    }
  }

  // Validate skip approval providers
  const providersToSkipApprovalFor = config?.signup?.approval?.skipApproval ?? [];
  for (const provider of providersToSkipApprovalFor) {
    if (!enabledProviders.includes(provider)) {
      throw new Error(
        `Configuration error - signup.approval.skipApproval contains unknown provider "${provider}"`,
      );
    }
  }

  // Validate step providers
  const steps = config?.signup?.steps ?? [];
  for (const step of steps) {
    if (step.type === 'link-providers') {
      const providers = step.providers ?? [];
      for (const provider of providers) {
        if (!enabledProviders.includes(provider)) {
          throw new Error(
            `Configuration error - signup step "${step.title}" references unknown provider "${provider}"`,
          );
        }
      }
    }
  }

  // validate link-providers step
  // list linkable providers from auth config
  const linkableProviderNames = authConfig
    ? Object.keys(authConfig).filter((p) => authConfig?.[p as AuthProvider]?.allowLinking)
    : [];

  if (config?.signup?.steps) {
    const linkProvidersStep = config.signup.steps.find((step) => step.type === 'link-providers');
    if (linkProvidersStep && !linkProvidersStep.providers) {
      throw new Error('Configuration error - signup step "Link Providers" must have providers');
    }

    if (linkProvidersStep && linkProvidersStep.providers) {
      const mismatchedProviders = [];
      for (const provider of linkProvidersStep.providers) {
        if (!linkableProviderNames.includes(provider)) {
          mismatchedProviders.push(provider);
        }
      }
      if (mismatchedProviders.length > 0) {
        throw new Error(
          `Configuration error - signup step "Link Providers" contains providers that do not allow linking: ${mismatchedProviders.join(', ')}`,
        );
      }
    }
  }
}
