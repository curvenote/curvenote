/**
 * WorkVersion metadata types and defaults have moved to schemas/work-version.ts
 * and are re-exported from @curvenote/scms-server.
 */

export type SubmissionVersionMetadata = {
  [key: string]: any;
  version: 1;
};

export function makeDefaultSubmissionVersionMetadata(): SubmissionVersionMetadata {
  return {
    version: 1,
  };
}
