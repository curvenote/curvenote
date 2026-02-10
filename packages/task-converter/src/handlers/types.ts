/**
 * HAT conversion handler types.
 * Each handler receives the request context and returns the absolute path to the built PDF.
 */

import type { HandlerContext } from '@curvenote/scms-tasks';
import type { ConverterPayload } from '../payload.js';

export type ConversionHandlerContext = HandlerContext<ConverterPayload>;

/**
 * A conversion handler runs the pipeline for one conversion type, performs upload and
 * work version metadata update when configured (e.g. via pdfUtils), and returns the
 * export path (local path or CDN path). The service signals job completed with that path.
 */
export type ConversionHandler = (ctx: ConversionHandlerContext) => Promise<string>;
