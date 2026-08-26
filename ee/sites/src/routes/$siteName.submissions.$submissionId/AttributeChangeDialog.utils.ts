export type AttributeChangeOption = {
  id: string;
  label: string;
};

export type AttributeChangeFetcherOutcome = 'pending' | 'success' | 'error';

type AttributeChangeItem = {
  id: string;
  name: string;
  content?: { title?: string };
};

export function buildAttributeChangeOptions(items: AttributeChangeItem[]): AttributeChangeOption[] {
  return items.map((item) => ({
    id: item.id,
    label: item.content?.title ?? item.name,
  }));
}

export function getOptimisticNameOrTitle(
  formData: FormData | undefined,
  ...fallbacks: (string | undefined)[]
): string | undefined {
  const fromForm = formData?.get('name_or_title');
  if (typeof fromForm === 'string' && fromForm.length > 0) {
    return fromForm;
  }

  for (const fallback of fallbacks) {
    if (fallback) {
      return fallback;
    }
  }

  return undefined;
}

export function resolveCollectionChangeOutcome(
  data: { error?: string; collection?: { id: string } } | undefined,
): AttributeChangeFetcherOutcome {
  if (!data) {
    return 'pending';
  }
  if (data.error) {
    return 'error';
  }
  if (data.collection) {
    return 'success';
  }
  return 'pending';
}

export function resolveKindChangeOutcome(
  data: { error?: string; kindId?: string } | undefined,
): AttributeChangeFetcherOutcome {
  if (!data) {
    return 'pending';
  }
  if (data.error) {
    return 'error';
  }
  if (data.kindId) {
    return 'success';
  }
  return 'pending';
}

export type FetcherIdleDialogAction = {
  closeDialog: boolean;
  clearAwaiting: boolean;
};

export function getFetcherIdleDialogAction(
  awaitingResult: boolean,
  prevFetcherState: string,
  currentFetcherState: string,
  outcome: AttributeChangeFetcherOutcome,
): FetcherIdleDialogAction | null {
  if (!awaitingResult || prevFetcherState === 'idle' || currentFetcherState !== 'idle') {
    return null;
  }

  if (outcome === 'success') {
    return { closeDialog: true, clearAwaiting: true };
  }

  if (outcome === 'error') {
    return { closeDialog: false, clearAwaiting: true };
  }

  return null;
}
