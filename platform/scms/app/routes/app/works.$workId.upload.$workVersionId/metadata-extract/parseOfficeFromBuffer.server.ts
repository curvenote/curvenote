/**
 * Parse office document bytes using the known source path extension.
 *
 * officeparser's buffer entry point relies on file-type magic-byte detection. Large
 * DOCX files with late [Content_Types].xml can be misidentified as generic zip. We
 * already validate extensions via isPreviewCandidate, so route directly to the
 * format-specific parser when the path is known.
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { officeParserFormatForPath } from '@curvenote/scms-core';
import type { OfficeParserAST, OfficeParserConfig } from 'officeparser';

type ParserFn = (buffer: Buffer, config: OfficeParserConfig) => Promise<OfficeParserAST>;

const require = createRequire(import.meta.url);
const officeparserRoot = join(dirname(require.resolve('officeparser')), '..');

function loadParser(modulePath: string, exportName: string): ParserFn {
  const mod = require(join(officeparserRoot, modulePath)) as Record<string, ParserFn>;
  const fn = mod[exportName];
  if (typeof fn !== 'function') {
    throw new Error(`officeparser parser not found: ${exportName} in ${modulePath}`);
  }
  return fn;
}

let parsersByExtension: Record<string, ParserFn> | null = null;

function getParsersByExtension(): Record<string, ParserFn> {
  if (!parsersByExtension) {
    const parseWord = loadParser('dist/parsers/WordParser.js', 'parseWord');
    const parsePowerPoint = loadParser('dist/parsers/PowerPointParser.js', 'parsePowerPoint');
    const parseExcel = loadParser('dist/parsers/ExcelParser.js', 'parseExcel');
    const parseOpenOffice = loadParser('dist/parsers/OpenOfficeParser.js', 'parseOpenOffice');
    const parsePdf = loadParser('dist/parsers/PdfParser.js', 'parsePdf');
    const parseRtf = loadParser('dist/parsers/RtfParser.js', 'parseRtf');

    parsersByExtension = {
      docx: parseWord,
      docm: parseWord,
      dotx: parseWord,
      dotm: parseWord,
      pptx: parsePowerPoint,
      xlsx: parseExcel,
      odt: parseOpenOffice,
      odp: parseOpenOffice,
      ods: parseOpenOffice,
      pdf: parsePdf,
      rtf: parseRtf,
    };
  }
  return parsersByExtension;
}

/** Resolve the officeparser routing extension (without dot) from a storage path or name. */
export function resolveOfficeParserExtension(sourcePath: string): string | undefined {
  const format = officeParserFormatForPath(sourcePath);
  if (!format) return undefined;
  return format.extensions[0]?.slice(1);
}

/**
 * Parse document bytes, using sourcePath for format routing instead of magic-byte detection.
 */
export async function parseOfficeFromBuffer(
  input: ArrayBuffer | Buffer,
  sourcePath: string,
  config: OfficeParserConfig = {},
): Promise<OfficeParserAST> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const ext = resolveOfficeParserExtension(sourcePath);
  if (ext) {
    const parser = getParsersByExtension()[ext];
    if (parser) {
      return parser(buffer, config);
    }
  }

  const { parseOffice } = await import('officeparser');
  return parseOffice(buffer, config);
}
