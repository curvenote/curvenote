// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DepositIssue } from '../../backend/deposit/types.js';
import { ReadyAlert } from './ReadyAlert.js';

function warning(message: string): DepositIssue {
  return { severity: 'warning', code: 'any', message };
}

describe('ReadyAlert', () => {
  it('says everything is available when there are no warnings', () => {
    const html = renderToStaticMarkup(<ReadyAlert warnings={[]} />);
    expect(html).toContain('<strong>Ready to register</strong>');
    expect(html).toContain('All required information is available.');
  });

  it('lists each warning as its own item under the recommended-metadata sentence', () => {
    const html = renderToStaticMarkup(
      <ReadyAlert
        warnings={[warning('No abstract found'), warning('No license information found')]}
      />,
    );
    expect(html).toContain(
      'This DOI can be registered, but some recommended metadata will not be included:',
    );
    expect(html).toMatch(
      /<ul[^>]*><li>No abstract found<\/li><li>No license information found<\/li><\/ul>/,
    );
  });
});
