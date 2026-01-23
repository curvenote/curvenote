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
}
