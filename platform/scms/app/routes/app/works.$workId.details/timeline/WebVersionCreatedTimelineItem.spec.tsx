// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { Suspense, type ReactNode } from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderToPipeableStream } from 'react-dom/server';
import { DeploymentProvider, type ClientDeploymentConfig } from '@curvenote/scms-core';
import type * as ReactRouter from 'react-router';
import { WebVersionCreatedTimelineItem } from './WebVersionCreatedTimelineItem';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouter>();
  return {
    ...actual,
    useFetcher: () => ({
      state: 'idle' as const,
      data: undefined,
      submit: () => {},
    }),
    useRevalidator: () => ({
      state: 'idle' as const,
      revalidate: () => {},
    }),
  };
});

const deploymentConfig = {
  workVersionPreviewUrl: 'https://preview.example',
} as ClientDeploymentConfig;

function renderHtml(node: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = '';
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(html);
    };

    const { pipe } = renderToPipeableStream(<Suspense fallback={null}>{node}</Suspense>, {
      onAllReady() {
        const sink = new PassThrough();
        sink.setEncoding('utf8');
        sink.on('data', (chunk: string) => {
          html += chunk;
        });
        sink.on('end', () => finish());
        sink.on('error', (error) => finish(error));
        pipe(sink);
      },
      onShellError(error) {
        finish(error);
      },
      onError(error) {
        finish(error);
      },
    });
  });
}

describe('WebVersionCreatedTimelineItem', () => {
  it('shows View when linked jobs reject but the MyST site and preview token are ready', async () => {
    const linkedJobs = Promise.reject(new Error('linked jobs failed'));
    void linkedJobs.catch(() => {});

    const html = await renderHtml(
      <DeploymentProvider config={deploymentConfig}>
        <WebVersionCreatedTimelineItem
          dateCreated="2026-09-23T10:00:00.000Z"
          dateModified="2026-09-23T10:05:00.000Z"
          workVersionId="wv-1"
          basePath="/app/works/work-1/details"
          previewSignature="tok"
          available
          linkedJobsByWorkVersionIdPromise={linkedJobs}
        />
      </DeploymentProvider>,
    );

    expect(html).toContain('View');
    expect(html).toContain('https://preview.example/previews/wv-1?preview=tok');
    expect(html).toContain('Web Version Ready');
  });
});
