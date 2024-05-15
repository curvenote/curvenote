import type { VFile } from 'vfile';
import type { DirectiveData } from 'myst-common';
import { u } from 'unist-builder';

export function validateStringOptions(
  vfile: VFile,
  fieldName: string,
  field: unknown,
  validValues: string[],
) {
  if (
    field &&
    (typeof field !== 'string' || (typeof field === 'string' && !validValues.includes(field)))
  ) {
    vfile.message(`Invalid ${fieldName} supplied must be one of (${validValues.join(' | ')}).`);
  }
}

export function makePlaceholder(data: DirectiveData, description: string) {
  const optionList = data.options
    ? [
        u(
          'ul',
          Object.entries(data.options)?.map(([key, value]) =>
            u('listItem', [u('inlineCode', key), u('text', `: ${String(value)}`)]),
          ) ?? [],
        ),
      ]
    : [];

  return [
    u('admonition', { kind: 'important' }, [
      u('admonitionTitle', [u('inlineCode', [u('text', data.name)])]),
      u('paragraph', [
        u('text', 'This block will be replaced with '),
        u('strong', [u('text', description)]),
        u('text', ' when deployed to '),
        u('link', { url: 'https://curvenote.com' }, [u('text', 'Curvenote')]),
        u('text', '.'),
      ]),
      u('paragraph', [u('text', 'Options:'), ...optionList]),
    ]),
  ];
}
