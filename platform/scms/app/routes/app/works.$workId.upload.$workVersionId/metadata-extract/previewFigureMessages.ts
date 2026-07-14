/** Client-safe helpers for upload preview figure UX. */

export function isPdfManuscriptPreview(file: {
  path?: string;
  name?: string;
  type?: string;
}): boolean {
  const pathOrName = file.path ?? file.name ?? '';
  if (pathOrName.toLowerCase().endsWith('.pdf')) return true;
  return (file.type ?? '').toLowerCase() === 'application/pdf';
}

export function figuresBusyMessageForPreviews(
  previews: ReadonlyArray<{ path: string; data: { path?: string; name?: string; type?: string } }>,
  isFiguresLoading: boolean,
): string {
  if (
    isFiguresLoading &&
    previews.some((preview) => isPdfManuscriptPreview({ ...preview.data, path: preview.path }))
  ) {
    return 'PDF extraction is slow and may not return all figures in this preview.';
  }
  return 'Generating thumbnail options…';
}
