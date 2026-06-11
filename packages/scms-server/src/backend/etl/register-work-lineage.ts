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
  venueBlock.supersedes_submission_version_id = supersedesSubmissionVersionId;
  return { ...base, [venueKey]: venueBlock };
}

/**
 * Old submission version metadata after tag migration.
 * Strips nothing from `version`; adds backward lineage fields only.
 */
export function applySupersededToSubmissionMetadata(
  metadata: unknown,
  venueKey: string,
  supersededBySubmissionVersionId: string,
  supersededAt: string,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {
      [venueKey]: {
        superseded_by_submission_version_id: supersededBySubmissionVersionId,
        superseded_at: supersededAt,
      },
    };
  }
  const record = { ...(metadata as Record<string, unknown>) };
  const venueBlock = venueBlockFromMetadata(record, venueKey);
  venueBlock.superseded_by_submission_version_id = supersededBySubmissionVersionId;
  venueBlock.superseded_at = supersededAt;
  record[venueKey] = venueBlock;
  return record;
}
