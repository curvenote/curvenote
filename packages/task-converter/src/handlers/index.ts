/**
 * HAT conversion handler registry.
 * Maps conversionType to the handler that produces the PDF for that pipeline.
 */

import type { ConversionType } from '../payload.js';
import type { ConversionHandler } from './types.js';
import { runDocxPandocMystPdf } from './docx-pandoc-myst-pdf/index.js';
import { runDocxLowriterPdf } from './docx-lowriter-pdf.js';

export type { ConversionHandler, ConversionHandlerContext } from './types.js';

export const HANDLERS: Record<ConversionType, ConversionHandler> = {
  'docx-pandoc-myst-pdf': runDocxPandocMystPdf,
  'docx-lowriter-pdf': runDocxLowriterPdf,
};

export function getHandler(conversionType: ConversionType): ConversionHandler {
  const handler = HANDLERS[conversionType];
  if (!handler) {
    throw new Error(`No handler registered for conversionType: ${conversionType}`);
  }
  return handler;
}
