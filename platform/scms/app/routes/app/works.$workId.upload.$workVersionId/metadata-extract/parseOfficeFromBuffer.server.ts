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

/** Mirrors officeparser's public `parseOffice` default config (see dist/officeparser.browser.mjs). */
const OFFICEPARSER_DEFAULT_CONFIG = {
  ignoreNotes: false,
  newlineDelimiter: '\n',
  putNotesAtLast: false,
  outputErrorToConsole: false,
  extractAttachments: false,
  ocr: false,
  ocrLanguage: 'eng',
  includeRawContent: false,
  serializeRawContent: true,
  preserveXmlWhitespace: false,
  pdfWorkerSrc: '',
  ocrConfig: {},
  includeBreakNodes: false,
} satisfies OfficeParserConfig;

const PARSER_MODULES: Record<string, { modulePath: string; exportName: string }> = {
  docx: { modulePath: 'dist/parsers/WordParser.js', exportName: 'parseWord' },
  docm: { modulePath: 'dist/parsers/WordParser.js', exportName: 'parseWord' },
  dotx: { modulePath: 'dist/parsers/WordParser.js', exportName: 'parseWord' },
  dotm: { modulePath: 'dist/parsers/WordParser.js', exportName: 'parseWord' },
  pptx: { modulePath: 'dist/parsers/PowerPointParser.js', exportName: 'parsePowerPoint' },
  xlsx: { modulePath: 'dist/parsers/ExcelParser.js', exportName: 'parseExcel' },
  odt: { modulePath: 'dist/parsers/OpenOfficeParser.js', exportName: 'parseOpenOffice' },
  odp: { modulePath: 'dist/parsers/OpenOfficeParser.js', exportName: 'parseOpenOffice' },
  ods: { modulePath: 'dist/parsers/OpenOfficeParser.js', exportName: 'parseOpenOffice' },
  pdf: { modulePath: 'dist/parsers/PdfParser.js', exportName: 'parsePdf' },
  rtf: { modulePath: 'dist/parsers/RtfParser.js', exportName: 'parseRtf' },
};

const parserByExtension = new Map<string, ParserFn>();

function loadParser(modulePath: string, exportName: string): ParserFn {
  const mod = require(join(officeparserRoot, modulePath)) as Record<string, ParserFn>;
  const fn = mod[exportName];
  if (typeof fn !== 'function') {
    throw new Error(`officeparser parser not found: ${exportName} in ${modulePath}`);
  }
  return fn;
}

function normalizeOfficeParserConfig(config: OfficeParserConfig): OfficeParserConfig {
  return { ...OFFICEPARSER_DEFAULT_CONFIG, ...config };
}

function getParserForExtension(ext: string): ParserFn | undefined {
  const spec = PARSER_MODULES[ext];
  if (!spec) return undefined;

  const cached = parserByExtension.get(ext);
  if (cached) return cached;

  try {
    const parser = loadParser(spec.modulePath, spec.exportName);
    parserByExtension.set(ext, parser);
    return parser;
  } catch (err) {
    console.warn('parseOfficeFromBuffer: failed to load internal parser', ext, err);
    return undefined;
  }
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
  const normalizedConfig = normalizeOfficeParserConfig(config);
  const ext = resolveOfficeParserExtension(sourcePath);

  if (ext) {
    const parser = getParserForExtension(ext);
    if (parser) {
      try {
        return await parser(buffer, normalizedConfig);
      } catch (err) {
        console.warn(
          'parseOfficeFromBuffer: internal parser failed, falling back to parseOffice',
          ext,
          err,
        );
      }
    }
  }

  const { parseOffice } = await import('officeparser');
  return parseOffice(buffer, normalizedConfig);
}
