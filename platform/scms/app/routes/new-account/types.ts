import type { GeneralError } from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-server';

export type LoaderData = {
  user: NonNullable<Context['user']>;
  currentStep: string;
};

export type ActionResponse = {
  success: boolean;
  message: string;
  redirectTo?: string;
  error?: GeneralError;
};
