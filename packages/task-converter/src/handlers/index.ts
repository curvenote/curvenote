/**
 * HAT conversion handler registry.
 * Maps conversionType to the handler that produces the PDF/site for that pipeline.
 * Legacy `docx-pandoc-myst-*` names alias to the Curvenote handlers.
 */

import type { ConversionType } from '../payload.js';
import type { ConversionHandler } from './types.js';
import { runDocxPandocMystPdf } from './docx-pandoc-myst-pdf/index.js';
import { runDocxLowriterPdf } from './docx-lowriter-pdf.js';
import { runDocxPandocMystWeb } from './docx-pandoc-myst-web/index.js';

export type { ConversionHandler, ConversionHandlerContext } from './types.js';

export const HANDLERS: Record<ConversionType, ConversionHandler> = {
  'docx-pd-curvenote-pdf': runDocxPandocMystPdf,
  'docx-pandoc-myst-pdf': runDocxPandocMystPdf,
  'docx-lowriter-pdf': runDocxLowriterPdf,
  'docx-pd-curvenote-web': runDocxPandocMystWeb,
  'docx-pandoc-myst-web': runDocxPandocMystWeb,
};

export function getHandler(conversionType: ConversionType): ConversionHandler {
  const handler = HANDLERS[conversionType];
  if (!handler) {
    throw new Error(`No handler registered for conversionType: ${conversionType}`);
  }
  return handler;
}
