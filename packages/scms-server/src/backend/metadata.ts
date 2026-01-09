export type WorkVersionCheckName = string; // 'curvenote-structure' | ...;

export type WorkVersionMetadata = {
  [key: string]: any;
  version: 1;
  checks?: {
    enabled: WorkVersionCheckName[];
  };
};

export function makeDefaultWorkVersionMetadata(): WorkVersionMetadata {
  return {
    version: 1,
  };
}

export type SubmissionVersionMetadata = {
  [key: string]: any;
  version: 1;
};

export function makeDefaultSubmissionVersionMetadata(): SubmissionVersionMetadata {
  return {
    version: 1,
  };
}
