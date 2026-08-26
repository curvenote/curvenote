import { isSafeSlug, looksLikeUUID } from '@curvenote/scms-core';
import type { SubmissionDetailSlugRow } from './types.js';
import { SUBMISSION_DETAIL_FORM_ACTIONS } from './SubmissionDetails.utils.js';

export type SlugConfirmAction = 'remove' | 'primary';

export type SlugConfirmTarget = {
  action: SlugConfirmAction;
  slugId: string;
  slug: string;
};

const SLUG_MIN_LENGTH = 6;
const SLUG_MAX_LENGTH = 64;

export function getDisplaySlug(slugs: SubmissionDetailSlugRow[], fallback: string): string {
  return slugs.find((s) => s.primary)?.slug ?? slugs[0]?.slug ?? fallback;
}

/** Prefill for the add-slug input (same default the legacy prompt used). */
export function getSuggestedSlugDraft(
  suggestion: string | undefined,
  slugs: SubmissionDetailSlugRow[],
): string | undefined {
  if (!suggestion) {
    return undefined;
  }
  if (slugs.some((s) => s.slug === suggestion)) {
    return undefined;
  }
  return suggestion;
}

export function validateSlugForAdd(
  slug: string,
  existingSlugs: SubmissionDetailSlugRow[],
): string | undefined {
  const trimmed = slug.trim();
  if (!trimmed) {
    return 'Enter a slug';
  }
  if (trimmed.length < SLUG_MIN_LENGTH) {
    return `Slug is too short (${trimmed.length} chars, minimum ${SLUG_MIN_LENGTH})`;
  }
  if (trimmed.length > SLUG_MAX_LENGTH) {
    return `Slug is too long (${trimmed.length} chars, maximum ${SLUG_MAX_LENGTH})`;
  }
  if (looksLikeUUID(trimmed)) {
    return 'Cannot use UUIDs as slugs';
  }
  if (!isSafeSlug(trimmed)) {
    return 'Invalid characters in slug (use alphanumeric, "-", "_" or "." only)';
  }
  if (existingSlugs.some((s) => s.slug === trimmed)) {
    return 'Slug already exists for this submission';
  }
  return undefined;
}

export type SlugAddFieldErrorInput = {
  localError: string | undefined;
  fetcherFormData: FormData | undefined;
  fetcherError: string | undefined;
};

export function getSlugAddFieldError({
  localError,
  fetcherFormData,
  fetcherError,
}: SlugAddFieldErrorInput): string | undefined {
  if (localError) {
    return localError;
  }
  if (
    fetcherError &&
    fetcherFormData?.get('formAction') === SUBMISSION_DETAIL_FORM_ACTIONS.slugAdd
  ) {
    return fetcherError;
  }
  return undefined;
}

export type SlugConfirmDialogErrorInput = {
  confirmTarget: SlugConfirmTarget | null;
  fetcherFormData: FormData | undefined;
  fetcherError: string | undefined;
};

export function getSlugConfirmDialogError({
  confirmTarget,
  fetcherFormData,
  fetcherError,
}: SlugConfirmDialogErrorInput): string | undefined {
  if (!confirmTarget || !fetcherError) {
    return undefined;
  }
  const formAction = fetcherFormData?.get('formAction');
  if (
    confirmTarget.action === 'remove' &&
    formAction === SUBMISSION_DETAIL_FORM_ACTIONS.slugRemove
  ) {
    return fetcherError;
  }
  if (
    confirmTarget.action === 'primary' &&
    formAction === SUBMISSION_DETAIL_FORM_ACTIONS.slugSetPrimary
  ) {
    return fetcherError;
  }
  return undefined;
}

export type SlugMutationOutcome = 'pending' | 'success' | 'error';

export function resolveSlugMutationOutcome(
  data: { error?: string; slugs?: SubmissionDetailSlugRow[] } | undefined,
): SlugMutationOutcome {
  if (!data) {
    return 'pending';
  }
  if (data.error) {
    return 'error';
  }
  if (data.slugs) {
    return 'success';
  }
  return 'pending';
}

export function getSlugConfirmCopy(action: SlugConfirmAction, slug: string) {
  if (action === 'remove') {
    return {
      title: 'Remove slug',
      description: `Are you sure you want to remove "${slug}"? This will break existing external links to the submission that use this slug.`,
      confirmLabel: 'Remove slug',
      submittingLabel: 'Removing...',
    };
  }

  return {
    title: 'Set primary slug',
    description: `Are you sure you want to set "${slug}" as the primary slug? This will redirect all other slugs here.`,
    confirmLabel: 'Set as primary',
    submittingLabel: 'Setting...',
  };
}
