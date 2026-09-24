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
import type { DoiRegistrationView } from './types.js';

const doi = '10.62329/abcd1234';

type RenderProps = {
  doi?: string;
  registration: DoiRegistrationView | null;
};

function render({ doi: workDoi, registration }: RenderProps) {
  return renderToStaticMarkup(
    <DoiRow
      doi={workDoi}
      registration={registration}
      readiness={null}
      canRegister
      resolvesTo="the work"
      statusUrl="/status"
      empty={null}
    />,
  );
}

describe('DoiRow', () => {
  it('shows the REGISTERED warning even when the work also resolves to a doi', () => {
    const html = render({
      doi,
      registration: { status: 'REGISTERED', doi, warning: 'Added with conflict' },
    });
    expect(html).toContain('Registered with a warning');
    expect(html).toContain(`href="https://doi.org/${doi}"`);
  });

  it('shows the work’s own doi instead of the failed state when one is set', () => {
    const html = render({
      doi,
      registration: { status: 'FAILED', doi, reason: { summary: 'x' } },
    });
    expect(html).toContain(`href="https://doi.org/${doi}"`);
    expect(html).not.toContain('Registration unsuccessful');
    expect(html).not.toContain('Retry');
  });

  it('shows the failed state when no doi resolves', () => {
    const html = render({
      registration: { status: 'FAILED', doi, reason: { summary: 'x' } },
    });
    expect(html).toContain('Registration unsuccessful');
  });
});
