export enum WorkContents {
  MYST = 'myst',
  FILES = 'files',
  PACKAGE = 'package',
  DATASET = 'dataset',
  // Add other work kinds here as needed
}

export const DEFAULT_WORK_CONTENTS = [WorkContents.MYST];

// export type WorkKind = (typeof WorkContents)[keyof typeof WorkContents];
