/**
 * Stable locator for a selected thumbnail figure, shared by the client (selection UI)
 * and the server (materialisation on submit).
 *
 * Candidate figures are downscaled at parse time and persisted to object storage under
 * the work version's `thumbnails/` subpath, so a figure is uniquely identified by its
 * storage key (path). The locator is simply that key; selection and materialisation
 * "deal exclusively with paths".
 */

export function encodeFigureLocator(storageKey: string): string {
  return storageKey;
}

export function decodeFigureLocator(locator: string): string | null {
  if (typeof locator !== 'string') return null;
  const key = locator.trim();
  return key.length > 0 ? key : null;
}

export function resolveThumbnailSelection(
  locators: string[],
  selectedLocator: string | null | undefined,
): string | null {
  if (locators.length === 0) return null;
  if (selectedLocator && locators.includes(selectedLocator)) return selectedLocator;
  return locators[0];
}

/** Preview-figure locators with an inherited thumbnail prepended for picker resolution. */
export function buildThumbnailCandidateLocators(
  figureLocators: string[],
  pinnedStorageKey: string | null | undefined,
): string[] {
  if (!pinnedStorageKey) return figureLocators;
  const pinnedLocator = encodeFigureLocator(pinnedStorageKey);
  const withoutPinned = figureLocators.filter((locator) => locator !== pinnedLocator);
  return [pinnedLocator, ...withoutPinned];
}
