// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DoiRegistrationState } from './DoiRegistrationState.js';
import type { RegisterDoiFetcher } from './DoiRow.js';
import type { DoiRegistrationView } from './types.js';

type FormProps = { children?: ReactNode };

const fetcher = {
  state: 'idle',
  Form: ({ children }: FormProps) => <form>{children}</form>,
} as unknown as RegisterDoiFetcher;

function render(registration: DoiRegistrationView, canRegister = true) {
  return renderToStaticMarkup(
    <DoiRegistrationState
      registration={registration}
      canRegister={canRegister}
      fetcher={fetcher}
    />,
  );
}

const doi = '10.62329/abcd1234';

describe('DoiRegistrationState', () => {
  it('shows a first attempt as in progress', () => {
    const html = render({ status: 'SUBMITTING', doi, retried: false });
    expect(html).toContain('Registration in progress');
    expect(html).toContain('Submitted to Crossref.');
    expect(html).not.toContain('Retry');
  });

  it('shows a retried attempt as resubmitting', () => {
    const html = render({ status: 'SUBMITTING', doi, retried: true });
    expect(html).toContain('Registration in progress');
    expect(html).toContain('Resubmitting the registration to Crossref');
  });

  it('shows a failed registration with Retry for someone who can register', () => {
    const html = render({ status: 'FAILED', doi, retried: false });
    expect(html).toContain('Registration unsuccessful');
    expect(html).toContain('Retry');
    expect(html).toContain('value="register-doi"');
  });

  it('shows a failed registration without Retry for someone who cannot register', () => {
    const html = render({ status: 'FAILED', doi, retried: false }, false);
    expect(html).toContain('Registration unsuccessful');
    expect(html).not.toContain('Retry');
  });

  it('shows the DOI once registered', () => {
    const html = render({ status: 'REGISTERED', doi, retried: false });
    expect(html).toContain(doi);
    expect(html).not.toContain('Registration');
  });
});
