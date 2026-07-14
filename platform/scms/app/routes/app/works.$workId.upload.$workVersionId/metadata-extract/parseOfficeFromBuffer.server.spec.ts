// eslint-disable-next-line import/no-extraneous-dependencies
import { createRequire } from 'node:module';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  parseOfficeFromBuffer,
  resolveOfficeParserExtension,
} from './parseOfficeFromBuffer.server';

const require = createRequire(import.meta.url);
// eslint-disable-next-line import/no-extraneous-dependencies
const { zipSync, strToU8 } = require('fflate');

/** Minimum uncompressed size that makes file-type skip [Content_Types].xml (>1 MiB). */
const UNPARSEABLE_CONTENT_TYPES_BYTES = 1024 * 1024 + 128;

function createMinimalDocx(): Buffer {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Hello preview</w:t></w:r></w:p></w:body>
</w:document>`),
  };
  return Buffer.from(zipSync(files));
}

/**
 * DOCX whose [Content_Types].xml exceeds file-type's 1 MiB entry read limit (stored,
 * not deflated). Magic-byte detection returns generic zip; extension routing still parses.
 */
function createZipMisidentifiedDocx(): Buffer {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <!--${'x'.repeat(UNPARSEABLE_CONTENT_TYPES_BYTES)}-->
</Types>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Late content types test</w:t></w:r></w:p></w:body>
</w:document>`),
  };

  return Buffer.from(zipSync(files, { level: 0 }));
}

describe('resolveOfficeParserExtension', () => {
  it('resolves docx from storage paths with spaces', () => {
    expect(resolveOfficeParserExtension('019f5fe5/manuscript/manuscript combined.docx')).toBe(
      'docx',
    );
  });

  it('resolves pdf from nested paths', () => {
    expect(resolveOfficeParserExtension('uploads/paper/final.pdf')).toBe('pdf');
  });

  it('returns undefined for unsupported extensions', () => {
    expect(resolveOfficeParserExtension('uploads/readme.txt')).toBeUndefined();
  });
});

describe('parseOfficeFromBuffer', () => {
  it('parses a minimal DOCX buffer using the source path extension', async () => {
    const buffer = createMinimalDocx();
    const ast = await parseOfficeFromBuffer(buffer, 'manuscript/manuscript.docx', {
      extractAttachments: false,
      newlineDelimiter: '\n',
    });

    expect(ast.type).toBe('docx');
    expect(ast.content.length).toBeGreaterThan(0);
    expect(ast.toText()).toContain('Hello preview');
  });

  it('parses DOCX when file-type misidentifies the buffer as zip', async () => {
    const buffer = createZipMisidentifiedDocx();
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(buffer);
    expect(detected?.ext).toBe('zip');

    const { parseOffice } = await import('officeparser');
    await expect(
      parseOffice(buffer, { extractAttachments: false, newlineDelimiter: '\n' }),
    ).rejects.toThrow(/zip files/);

    const ast = await parseOfficeFromBuffer(buffer, 'manuscript/manuscript combined.docx', {
      extractAttachments: false,
      newlineDelimiter: '\n',
    });

    expect(ast.type).toBe('docx');
    expect(ast.content.length).toBeGreaterThan(0);
    expect(ast.toText()).toContain('Late content types test');
  });
});
