import type { Step } from '@/types/app-config.js';

/**
 * Signup-related type definitions
 */

/**
 * Authentication configuration types for signup flow
 */
export type SigninSignupConfig = {
  signin?: SigninConfig;
  signup?: SignupConfig;
};

export type SigninConfig = {
  mode?: 'preferred' | 'all';
  preferred?: string;
  prompt?: string;
  alternativePrompt?: string;
};

export type SignupConfig = {
  mode?: 'preferred' | 'all';
  preferred?: string;
  prompt?: string;
  alternativePrompt?: string;
  progressMessage?: string;
  steps?: Step[];
  approval?: ApprovalConfig;
};

export type ApprovalConfig = {
  manual?: boolean;
  skipApproval?: string[];
};

/**
 * Client-safe authentication configuration (no sensitive data)
 */
export type ClientSigninSignupConfig = {
  signin?: ClientSigninConfig;
  signup?: ClientSignupConfig;
};

export type ClientSigninConfig = {
  mode?: 'preferred' | 'all';
  preferred?: string;
  prompt?: string;
  alternativePrompt?: string;
};

export type ClientSignupConfig = {
  mode?: 'preferred' | 'all';
  preferred?: string;
  prompt?: string;
  alternativePrompt?: string;
  progressMessage?: string;
  steps?: Step[]; // Steps can be exposed as they contain no secrets
};

/**
 * Comprehensive type definition for the user data JSON field
 * Contains signup and other user-related data
 */
export type UserData = {
  /** Signup-related data */
  signup?: SignupData;

  /** Other user data can be added here in the future */
  [key: string]: any;
};

/**
 * Comprehensive type definition for the signup_data JSON field
 * Based on how the data is actually used throughout the signup flow
 */
export type SignupData = {
  /** Timestamp when the last update was made to signup data */
  lastUpdated?: string;

  /** Timestamp when the entire signup flow was completed */
  completedAt?: string;

  currentStep?: string;

  /** Current status of the signup process */
  completed?: boolean;

  /** Reason why approval was skipped (if applicable) */
  skipReason?: 'trusted_provider' | string;

  /** Record of completed steps keyed by step type */
  steps?: {
    [stepType: string]: SignupStepData;
  };
};

export type SignupStepData = SignupStepBaseData & SignupStepSpecificData;

/**
 * Individual step completion data
 */
export type SignupStepBaseData = {
  /** Timestamp when this step was completed */
  completedAt: string;

  /** Whether the step is marked as completed */
  completed?: boolean;
};

/**
 * Step-specific data content - varies by step type
 */
export type SignupStepSpecificData =
  | LinkProvidersStepData
  | DataCollectionStepData
  | AgreementStepData
  | { type: 'custom'; [key: string]: any }; // Allow for future step types

/**
 * Data for link-providers step
 */
export type LinkProvidersStepData = {
  /** Step type identifier */
  type: 'link-providers';

  /** Whether the user manually skipped this step */
  skippedByUser?: boolean;

  /** Provider being linked (during linking process) */
  linkingProvider?: string;

  /** Timestamp when linking was attempted */
  linkingAttemptedAt?: string;

  /** Whether the step is marked as completed */
  completed?: boolean;
};

/**
 * Data for data-collection step
 * Contains form field data collected from the user
 */
export type DataCollectionStepData = {
  /** Step type identifier */
  type: 'data-collection';

  /** User's display name */
  displayName?: string;

  /** User's email */
  email?: string;

  /** Any additional fields configured for this step */
  [fieldName: string]: any;
};

/**
 * Data for agreement step
 */
export type AgreementStepData = {
  /** Step type identifier */
  type: 'agreement';

  /** Whether the user has accepted the agreements */
  accepted: boolean;

  /** URLs of the agreements (newer format) */
  agreementUrls?: string[];
};

// Re-export Step type from app-config
export type { Step };
