/**
 * Initial work version `metadata` for new file-upload drafts: no checks enabled until the user opts in on upload.
 * Used when creating a draft work (`dbCreateDraftFileWork`) or draft work version (`dbCreateDraftWorkVersion`).
 */
export function metadataForNewDraftFileWorkVersion(): Record<string, unknown> {
  return {
    checks: {
      enabled: [],
    },
  };
}
