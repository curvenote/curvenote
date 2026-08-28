// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SubmissionMediaSection } from './SubmissionMediaSection.js';

describe('SubmissionMediaSection', () => {
  it('renders the thumbnail image when a URL is provided', () => {
    const html = renderToStaticMarkup(
      <SubmissionMediaSection thumbnailUrl="https://cdn.example/thumb.webp" title="My Paper" />,
    );
    expect(html).toContain('MEDIA');
    expect(html).toContain('Thumbnail');
    expect(html).toContain('src="https://cdn.example/thumb.webp"');
    expect(html).toContain('alt="My Paper"');
    expect(html).not.toContain('No Thumbnail');
  });

  it('renders a No Thumbnail placeholder when URL is missing', () => {
    const html = renderToStaticMarkup(
      <SubmissionMediaSection thumbnailUrl={undefined} title="My Paper" />,
    );
    expect(html).toContain('MEDIA');
    expect(html).toContain('No Thumbnail');
    expect(html).not.toContain('<img');
  });
});
