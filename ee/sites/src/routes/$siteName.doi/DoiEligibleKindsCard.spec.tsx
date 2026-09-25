// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

type FormProps = { children?: ReactNode };
type LinkProps = { to: string; className?: string; children?: ReactNode };

vi.mock('react-router', () => ({
  useFetcher: () => ({
    state: 'idle',
    data: undefined,
    Form: ({ children }: FormProps) => <form>{children}</form>,
  }),
  Link: ({ to, className, children }: LinkProps) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { DoiEligibleKindsCard } from './DoiEligibleKindsCard.js';
import type { EligibleKindDTO } from '../../backend/doi/types.js';

function render(kinds: EligibleKindDTO[]) {
  return renderToStaticMarkup(
    <DoiEligibleKindsCard kinds={kinds} kindsUrl="/app/sites/science/kinds" />,
  );
}

describe('DoiEligibleKindsCard', () => {
  it('shows each kind checked as saved, and links to the kinds settings', () => {
    const html = render([
      { id: 'kind-article', title: 'Article', doiContentType: 'PREPRINT' },
      { id: 'kind-blog', title: 'Blog', doiContentType: null },
    ]);
    expect(html).toContain('Article');
    expect(html).toContain('Blog');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toContain('href="/app/sites/science/kinds"');
    expect(html).toContain('name="intent" value="update-kind-mapping"');
    expect(html).not.toContain('name="occ"');
  });

  it('lays the kinds out under Submission Kind and DOI content type columns', () => {
    const html = render([{ id: 'kind-article', title: 'Article', doiContentType: null }]);
    expect(html).toContain(
      'Choose which enabled Submission Kinds can receive DOIs and how they should be registered.',
    );
    expect(html).toContain('Submission Kind</div>');
    expect(html).toContain('DOI content type</div>');
    expect(html).toContain(
      'Newly enabled Submission Kinds will automatically appear here for review.',
    );
  });

  it('says so when the site has no kinds', () => {
    expect(render([])).toContain('This Site has no Submission Kinds yet.');
  });
});
