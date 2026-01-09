import type { Step } from '@/types/app-config.js';
import { getPrismaClient } from '../prisma.server.js';
import type { DataCollectionStepData } from '@curvenote/scms-core';
import type { MyUserDBO } from '../db.types.js';

/**
 * Step validator function signature
 */
export type StepValidator = (
  stepData: any,
  user: MyUserDBO,
  stepConfig: Step,
) => Promise<{ isValid: boolean; error?: string }>;

/**
 * Validation result for all steps
 */
export type StepsValidationResult = {
  isValid: boolean;
  errors: string[];
};

/**
 * Registry of step validators by step type
 */
const stepValidators: Record<string, StepValidator> = {
  'link-providers': validateLinkProvidersStep,
  'data-collection': validateDataCollectionStep,
  agreement: validateAgreementStep,
};

/**
 * Validate all completed signup steps for a user
 */
export async function validateAllSignupSteps(
  user: MyUserDBO,
  signupData: any,
  signupSteps: Step[],
): Promise<StepsValidationResult> {
  const errors: string[] = [];
  const completedSteps = signupData.steps || {};

  for (const step of signupSteps) {
    const stepData = completedSteps[step.type];

    if (!stepData?.completedAt) {
      errors.push(`Step "${step.title}" (${step.type}) must be completed`);
      continue;
    }

    const validator = stepValidators[step.type];
    if (!validator) {
      errors.push(`No validator found for step type: ${step.type}`);
      continue;
    }

    try {
      const result = await validator(stepData, user, step);
      if (!result.isValid) {
        errors.push(result.error || `Step "${step.title}" validation failed`);
      }
    } catch (error) {
      errors.push(
        `Step "${step.title}" validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate link-providers step
 *
 * Ensures that either:
 * 1. The step was skipped by the user, OR
 * 2. All configured providers have been successfully linked
 */
async function validateLinkProvidersStep(
  stepData: any,
  user: MyUserDBO,
  stepConfig: Step,
): Promise<{ isValid: boolean; error?: string }> {
  const prisma = await getPrismaClient();

  // Get configured providers for this step
  const configuredProviders = stepConfig.providers || [];
  if (configuredProviders.length === 0) {
    return { isValid: true }; // No providers configured, step is valid
  }

  // Check that all configured providers have been linked
  const linkedAccounts = await prisma.userLinkedAccount.findMany({
    where: {
      user_id: user.id,
      provider: { in: configuredProviders },
      pending: false, // Only count non-pending linked accounts
    },
    select: { provider: true },
  });

  const linkedProviders = linkedAccounts.map((account) => account.provider);
  let missingProviders = configuredProviders.filter(
    (provider) => !linkedProviders.includes(provider),
  );

  // HACK: handle firebase / google name collision
  if (configuredProviders.includes('firebase') && user.primaryProvider === 'google') {
    missingProviders = missingProviders.filter((provider) => provider !== 'firebase');
  }

  // If all providers are linked, step is valid regardless of skip status
  if (missingProviders.length === 0) {
    return { isValid: true };
  }

  // If not all providers are linked, check if user skipped this step
  if (stepData?.skippedByUser === true) {
    return { isValid: true };
  }

  // If neither all providers are linked nor step was skipped, it's invalid
  return {
    isValid: false,
    error: `Missing linked accounts for providers: ${missingProviders.join(', ')}`,
  };
}

/**
 * Validate data-collection step
 *
 * Ensures that required user profile data has been collected:
 * 1. Display name
 * 3. Email
 */
async function validateDataCollectionStep(
  stepData: DataCollectionStepData,
  user: MyUserDBO,
): Promise<{ isValid: boolean; error?: string }> {
  if (!user) {
    return { isValid: false, error: 'User not found' };
  }

  const missingFields: string[] = [];

  if (stepData.displayName === undefined || stepData.displayName?.trim() === '') {
    missingFields.push('display name');
  }

  if (stepData.email === undefined || stepData.email?.trim() === '') {
    missingFields.push('email');
  }

  if (missingFields.length > 0) {
    return {
      isValid: false,
      error: `Missing required fields: ${missingFields.join(', ')}`,
    };
  }

  return { isValid: true };
}

/**
 * Validate agreement step
 *
 * Ensures that:
 * 1. The user has accepted the agreements (accepted flag is true)
 * 2. One or more agreement URLs are stored in the signup data
 */
async function validateAgreementStep(
  stepData: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  user: MyUserDBO,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _stepConfig: Step,
): Promise<{ isValid: boolean; error?: string }> {
  // Check that user has accepted the agreements
  if (stepData?.accepted !== true) {
    return {
      isValid: false,
      error: 'User must accept the agreements to complete signup',
    };
  }

  // Check that agreement URLs are stored
  const agreementUrls = stepData?.agreementUrls || stepData?.urls || [];
  if (!Array.isArray(agreementUrls) || agreementUrls.length === 0) {
    return {
      isValid: false,
      error: 'Agreement URLs must be stored in signup data',
    };
  }

  return { isValid: true };
}
