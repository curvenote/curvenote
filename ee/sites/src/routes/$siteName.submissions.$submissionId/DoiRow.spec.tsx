// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type * as DoiRowRefresh from './doiRowRefresh.js';

type FormProps = { children?: ReactNode };

vi.mock('react-router', () => ({
  useFetcher: () => ({
    state: 'idle',
    data: undefined,
    Form: ({ children }: FormProps) => <form>{children}</form>,
  }),
}));
vi.mock('./doiRowRefresh.js', async () => {
  const actual = await vi.importActual<typeof DoiRowRefresh>('./doiRowRefresh.js');
  return { ...actual, useDoiRowRefresh: () => {} };
});

import { DoiRow } from './DoiRow.js';
import type { DoiRowState } from './types.js';

const doi = '10.62329/abcd1234';

function render(state: DoiRowState) {
  return renderToStaticMarkup(
    <DoiRow
      state={state}
      canRegister
      resolvesTo="the work"
      statusUrl="/status"
      empty={<span>empty</span>}
    />,
  );
}

describe('DoiRow', () => {
  it('shows the registration state it is given', () => {
    const html = render({
      kind: 'registration',
      registration: { status: 'REGISTERED', doi, warning: 'Added with conflict' },
    });
    expect(html).toContain('Registered with a warning');
    expect(html).toContain(`href="https://doi.org/${doi}"`);
  });

  it('shows a DOI as a link', () => {
    const html = render({ kind: 'doi', doi });
    expect(html).toContain(`href="https://doi.org/${doi}"`);
    expect(html).not.toContain('Retry');
  });

  it('shows the empty value when there is nothing to show', () => {
    expect(render({ kind: 'none' })).toBe('<span>empty</span>');
  });
});
