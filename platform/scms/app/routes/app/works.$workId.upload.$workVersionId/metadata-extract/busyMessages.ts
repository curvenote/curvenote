/** Format guidance shown while preview generation or metadata extraction is in progress. */
export const UPLOAD_FORMAT_BUSY_TIPS = [
  'PDFs may take longer to process than DOCX files.',
  "Upload DOCX files whenever you can — you'll be able to do more with them later.",
] as const;

/** Rotating busy messages shown while previews are being generated. */
export const PREVIEW_BUSY_MESSAGES = [
  'Extracting document contents…',
  'Building structured data…',
  'Generating thumbnails…',
  ...UPLOAD_FORMAT_BUSY_TIPS,
] as const;

/** Interval (ms) between rotating busy messages. */
export const BUSY_MESSAGE_INTERVAL_MS = 3000;
