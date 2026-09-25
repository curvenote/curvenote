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
  it('shows a first attempt being sent', () => {
    const html = render({ status: 'SUBMITTING', doi, phase: 'sending', retried: false });
    expect(html).toContain('Registration in progress');
    expect(html).toContain('Sending to Crossref…');
    expect(html).not.toContain('Retry');
  });

  it('shows a retried attempt being resent', () => {
    const html = render({ status: 'SUBMITTING', doi, phase: 'sending', retried: true });
    expect(html).toContain('Resubmitting to Crossref…');
  });

  it('shows the wait for Crossref with the DOI as plain text', () => {
    const html = render({ status: 'SUBMITTING', doi, phase: 'waiting', retried: false });
    expect(html).toContain('Waiting for Crossref');
    expect(html).toContain('Crossref has received the registration and is checking it.');
    expect(html).toContain(doi);
    expect(html).not.toContain('href=');
  });

  it('shows the reason and Retry for someone who can register', () => {
    const html = render({
      status: 'FAILED',
      doi,
      reason: {
        summary:
          "Crossref didn't confirm the registration within 72 hours. Retry to submit it again.",
      },
    });
    expect(html).toContain('Registration unsuccessful');
    expect(html).toContain('within 72 hours');
    expect(html).toContain('value="register-doi"');
    expect(html).not.toContain('<details');
  });

  it('folds Crossref message under the summary', () => {
    const html = render({
      status: 'FAILED',
      doi,
      reason: {
        summary: 'Crossref rejected the metadata. Fix the submission and retry.',
        detail: 'cvc-complex-type.2.4.a',
      },
    });
    expect(html).toContain('<details');
    expect(html).toContain('Show Crossref&#x27;s message');
    expect(html).toContain('cvc-complex-type.2.4.a');
  });

  it('hides Retry from someone who cannot register', () => {
    const html = render({ status: 'FAILED', doi, reason: { summary: 'x' } }, false);
    expect(html).toContain('Registration unsuccessful');
    expect(html).not.toContain('Retry');
  });

  it('shows a registered DOI as a link with no badge', () => {
    const html = render({ status: 'REGISTERED', doi });
    expect(html).toContain(`href="https://doi.org/${doi}"`);
    expect(html).not.toContain('Registered with a warning');
  });

  it('shows Crossref warning next to a registered DOI', () => {
    const html = render({ status: 'REGISTERED', doi, warning: 'Added with conflict' });
    expect(html).toContain(`href="https://doi.org/${doi}"`);
    expect(html).toContain('Registered with a warning');
    expect(html).toContain('Crossref registered the DOI but reported: Added with conflict');
  });
});
