/* eslint-disable import/no-extraneous-dependencies */
import http from 'node:http';
import type { Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { dockerAwareFetch } from './dockerFetch.js';

describe('dockerAwareFetch', () => {
  const servers: http.Server[] = [];
  const prevRewrite = process.env.TASK_CONVERTER_REWRITE_LOCALHOST;
  const prevGateway = process.env.TASK_CONVERTER_HOST_GATEWAY;

  afterEach(async () => {
    process.env.TASK_CONVERTER_REWRITE_LOCALHOST = prevRewrite;
    process.env.TASK_CONVERTER_HOST_GATEWAY = prevGateway;
    await Promise.all(
      servers.splice(0).map(
        (s) =>
          new Promise<void>((resolve, reject) => {
            s.closeAllConnections();
            s.close((err) => (err ? reject(err) : resolve()));
          }),
      ),
    );
  });

  it('preserves Host: 127.0.0.1:port while connecting via gateway', async () => {
    process.env.TASK_CONVERTER_REWRITE_LOCALHOST = '1';

    let seenHost: string | undefined;
    const server = http.createServer((req, res) => {
      seenHost = req.headers.host;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
    servers.push(server);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('expected TCP address');
    process.env.TASK_CONVERTER_HOST_GATEWAY = '127.0.0.1';

    const signedPort = addr.port;
    const response = await dockerAwareFetch(
      `http://127.0.0.1:${signedPort}/object?X-Amz-Signature=x`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(seenHost).toBe(`127.0.0.1:${signedPort}`);
  });

  it('forwards AbortSignal by destroying the rewritten request', async () => {
    process.env.TASK_CONVERTER_REWRITE_LOCALHOST = '1';
    process.env.TASK_CONVERTER_HOST_GATEWAY = '127.0.0.1';

    const server = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200);
        res.end('late');
      }, 5_000);
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('expected TCP address');

    const controller = new AbortController();
    const pending = dockerAwareFetch(`http://127.0.0.1:${addr.port}/slow`, {
      signal: controller.signal,
    });
    // Let the request start, then abort.
    await new Promise((r) => setTimeout(r, 20));
    controller.abort();
    await expect(pending).rejects.toThrow(/abort|failed/i);
    // Drain any late socket errors before afterEach closes the server.
    await new Promise((r) => setTimeout(r, 50));
  });

  it('destroys the socket when the signal is already aborted', async () => {
    process.env.TASK_CONVERTER_REWRITE_LOCALHOST = '1';
    process.env.TASK_CONVERTER_HOST_GATEWAY = '127.0.0.1';

    const open = new Set<Socket>();
    const server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('should-not-be-read');
    });
    server.on('connection', (socket) => {
      open.add(socket);
      socket.on('close', () => open.delete(socket));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('expected TCP address');

    const controller = new AbortController();
    controller.abort();

    await expect(
      dockerAwareFetch(`http://127.0.0.1:${addr.port}/object`, { signal: controller.signal }),
    ).rejects.toThrow(/abort/i);

    await new Promise((r) => setTimeout(r, 50));
    expect(open.size).toBe(0);
  });
});
