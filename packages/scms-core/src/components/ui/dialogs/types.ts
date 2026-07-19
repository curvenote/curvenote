/**
 * Base draft work type - can be extended for specific use cases
 */
export interface DraftWork {
  workId: string;
  workVersionId: string;
  workTitle: string;
  dateModified: string;
  dateCreated: string;
  metadata?: any;
  /** 1-based version index for resume dialogs (work versions or submission versions). */
  versionNumber?: number;
}
