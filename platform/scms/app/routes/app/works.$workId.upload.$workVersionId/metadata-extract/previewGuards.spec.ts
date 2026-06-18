// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { OCTET_STREAM_MIME } from '../manuscriptFormats';
import { isPreviewCandidate } from './previewGuards';

describe('preview candidate guards', () => {
  it.each([
    [
      'docx',
      {
        path: 'uploads/manuscript.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
    ['pdf', { path: 'uploads/manuscript.pdf', type: 'application/pdf' }],
    ['docx with octet-stream MIME', { path: 'uploads/manuscript.docx', type: OCTET_STREAM_MIME }],
    ['pdf with octet-stream MIME', { path: 'uploads/manuscript.pdf', type: OCTET_STREAM_MIME }],
    ['extension from name fallback', { name: 'manuscript.pdf', type: 'application/pdf' }],
  ])('accepts %s preview candidates', (_name, file) => {
    expect(isPreviewCandidate(file)).toBe(true);
  });

  it.each([
    ['empty MIME', { path: 'uploads/manuscript.pdf', type: '' }],
    ['missing MIME', { path: 'uploads/manuscript.pdf' }],
    ['non-candidate extension', { path: 'uploads/manuscript.txt', type: 'text/plain' }],
    [
      'parseable but not dropzone-allowed format',
      { path: 'uploads/slides.pptx', type: OCTET_STREAM_MIME },
    ],
    ['wrong MIME for extension', { path: 'uploads/manuscript.pdf', type: 'text/plain' }],
  ])('rejects %s', (_name, file) => {
    expect(isPreviewCandidate(file)).toBe(false);
  });
});
