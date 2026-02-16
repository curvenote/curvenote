import type { LinkedJobWithStatus } from '../works.$workId/db.server';

/** Map of work version ID to linked jobs (with status) for that version. */
export type LinkedJobsByWorkVersionId = Record<string, LinkedJobWithStatus[]>;
