import {
  TAG_LABEL_MAX_LENGTH,
  isValidTagLabel,
  isValidTagName,
  toTagName,
} from '@curvenote/scms-core';

export type TagNamePreviewStatus = 'empty' | 'valid' | 'invalid';

export type TagNamePreview = {
  name: string;
  status: TagNamePreviewStatus;
};

export function getTagNamePreview(label: string): TagNamePreview {
  const trimmed = label.trim();
  if (!trimmed) {
    return { name: '', status: 'empty' };
  }
  const name = toTagName(trimmed);
  if (!isValidTagName(name)) {
    return { name, status: 'invalid' };
  }
  return { name, status: 'valid' };
}

export function getTagLabelValidationError(label: string): string | undefined {
  const trimmed = label.trim();
  if (!isValidTagLabel(trimmed)) {
    return `tag label must be 1 to ${TAG_LABEL_MAX_LENGTH} characters`;
  }
  if (!isValidTagName(toTagName(trimmed))) {
    return `invalid tag name derived from label: "${trimmed}"`;
  }
  return undefined;
}

export function getTagEditLabelError(label: string): string | undefined {
  const trimmed = label.trim();
  if (!isValidTagLabel(trimmed)) {
    return `tag label must be 1 to ${TAG_LABEL_MAX_LENGTH} characters`;
  }
  return undefined;
}

export type CreateTagDuplicateErrorInput = {
  label: string;
  existingNames: string[];
};

export function getCreateTagDuplicateError(
  input: CreateTagDuplicateErrorInput,
): string | undefined {
  const name = toTagName(input.label.trim());
  if (name && input.existingNames.includes(name)) {
    return 'a tag with this name already exists';
  }
  return undefined;
}

export type TagCatalogFetcherData = {
  error?: string | { message?: string; field?: string };
  tag?: { id: string };
  deleted?: boolean;
};

export function getFetcherErrorParts(data: TagCatalogFetcherData | undefined): {
  message?: string;
  field?: string;
} {
  if (!data?.error) {
    return {};
  }
  if (typeof data.error === 'string') {
    return { message: data.error };
  }
  return { message: data.error.message, field: data.error.field };
}

export type TagFormFieldErrorInput = {
  localError: string | undefined;
  fetcherError: string | undefined;
  fetcherField: string | undefined;
};

export function getTagFormFieldError(input: TagFormFieldErrorInput): string | undefined {
  if (input.localError) {
    return input.localError;
  }
  if (input.fetcherField === 'label') {
    return input.fetcherError;
  }
  return undefined;
}

export type TagDialogAlertErrorInput = {
  fetcherError: string | undefined;
  fetcherField: string | undefined;
};

export function getTagDialogAlertError(input: TagDialogAlertErrorInput): string | undefined {
  if (input.fetcherError && input.fetcherField !== 'label') {
    return input.fetcherError;
  }
  return undefined;
}

export type DeleteDialogAlertErrorInput = {
  submittedThisOpen: boolean;
  isSubmitting: boolean;
  fetcherMessage: string | undefined;
};

export function getDeleteDialogAlertError(input: DeleteDialogAlertErrorInput): string | undefined {
  if (!input.submittedThisOpen || input.isSubmitting) {
    return undefined;
  }
  return input.fetcherMessage;
}

export function resolveTagCatalogOutcome(
  data: TagCatalogFetcherData | undefined,
): 'pending' | 'success' | 'error' {
  if (!data) {
    return 'pending';
  }
  if (data.error) {
    return 'error';
  }
  if (data.tag || data.deleted) {
    return 'success';
  }
  return 'pending';
}

export type TagDialogIdleAction = {
  closeDialog: boolean;
  clearAwaiting: boolean;
};

export type TagDialogIdleActionInput = {
  awaitingResult: boolean;
  prevFetcherState: string;
  currentFetcherState: string;
  outcome: 'pending' | 'success' | 'error';
};

export function getTagDialogIdleAction(
  input: TagDialogIdleActionInput,
): TagDialogIdleAction | null {
  if (
    !input.awaitingResult ||
    input.prevFetcherState === 'idle' ||
    input.currentFetcherState !== 'idle'
  ) {
    return null;
  }
  if (input.outcome === 'success') {
    return { closeDialog: true, clearAwaiting: true };
  }
  if (input.outcome === 'error') {
    return { closeDialog: false, clearAwaiting: true };
  }
  return null;
}

export type TagsTableColumn = 'label' | 'name' | 'created' | 'actions';

export type TagsTableColumnPin = 'start' | 'end' | 'none';

export function getTagsTableColumnPin(column: TagsTableColumn): TagsTableColumnPin {
  if (column === 'label') {
    return 'start';
  }
  if (column === 'actions') {
    return 'end';
  }
  return 'none';
}

export function getTagDeleteCopy(label: string) {
  return {
    title: 'Delete tag',
    description: `This removes "${label}" from the catalog. It is removed from every submission that had it. This cannot be undone.`,
    confirmLabel: 'Delete tag',
    submittingLabel: 'Deleting...',
  };
}
