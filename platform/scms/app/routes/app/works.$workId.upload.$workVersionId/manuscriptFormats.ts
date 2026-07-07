/**
 * Re-export manuscript format constants from scms-core (single source of truth).
 */
export {
  MANUSCRIPT_UPLOAD_ACCEPT,
  MANUSCRIPT_UPLOAD_MIME_TYPES,
  OCTET_STREAM_MIME,
  OFFICEPARSER_SUPPORTED_FORMATS,
  officeParserFormatForPath,
  isPreviewCandidate,
} from '@curvenote/scms-core';
export type { OfficeParserFormat } from '@curvenote/scms-core';
