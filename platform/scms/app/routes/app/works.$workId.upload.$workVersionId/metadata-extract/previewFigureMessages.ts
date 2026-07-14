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
    return 'Extracting thumbnails from PDF can take longer. This is a preview and if not all images are shown this does not mean they are missing from your document.';
  }
  return 'Generating thumbnail options…';
}
