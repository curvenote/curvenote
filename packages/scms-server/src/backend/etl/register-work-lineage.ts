function venueBlockFromMetadata(
  metadata: Record<string, unknown> | undefined,
  venueKey: string,
): Record<string, unknown> {
  const existing = metadata?.[venueKey];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return { ...(existing as Record<string, unknown>) };
  }
  return {};
}

/** New submission version metadata: forward link to the replaced submission version. */
export function buildSubmissionMetadataWithSupersedes(
  submissionMetadata: Record<string, unknown> | undefined,
  venueKey: string,
  supersedesSubmissionVersionId: string,
): Record<string, unknown> {
  const base =
    submissionMetadata &&
    typeof submissionMetadata === 'object' &&
    !Array.isArray(submissionMetadata)
      ? { ...submissionMetadata }
      : {};
  const venueBlock = venueBlockFromMetadata(base, venueKey);
  venueBlock.supersedes = supersedesSubmissionVersionId;
  return { ...base, [venueKey]: venueBlock };
}
