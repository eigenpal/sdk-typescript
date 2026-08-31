import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EigenpalClient } from '../src';
import type { TemplatesContentGetResponses } from '../src/generated/types.gen';

function asTemplateBytes(value: TemplatesContentGetResponses[200]): Blob | File {
  return value;
}

describe('templates resource', () => {
  test('negotiates file transport before create and downloads a pinned revision', async () => {
    const requests: Request[] = [];
    const fetch = (async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      requests.push(request.clone());
      if (request.url.includes('/content')) {
        return new Response('template-bytes', {
          headers: { 'content-type': 'application/octet-stream' },
        });
      }
      if (request.url.endsWith('/v1/files/uploads')) {
        return Response.json({
          transport: 'multipart',
          url: '/v1/files',
          maxFileSizeBytes: 50_000_000,
        });
      }
      if (request.url.endsWith('/v1/files') && request.method === 'POST') {
        return Response.json({ id: 'file_123456789012345678901' });
      }
      if (request.url.includes('/v1/files/file_') && request.method === 'DELETE') {
        return Response.json({ deleted: true });
      }
      return Response.json({
        id: 'tmpl_1',
        name: 'Contract',
        filename: 'contract.docx',
        format: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 3,
        sha256: 'a'.repeat(64),
        tokens: [],
        grammar: { syntax: '{field}', tokenDiscovery: true, capabilities: [] },
        currentRevision: {
          id: 'tmpr_1',
          number: 1,
          sha256: 'a'.repeat(64),
          createdAt: '2026-08-28T00:00:00.000Z',
        },
        createdAt: '2026-08-28T00:00:00.000Z',
      });
    }) as typeof globalThis.fetch;
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.templates.create(new File(['doc'], 'contract.docx'), { name: 'Contract' });
    expect(requests[0]!.url).toContain('/v1/files/uploads');
    expect(requests[1]!.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
    const createRequest = requests.find(
      (request) => request.url.endsWith('/v1/templates') && request.method === 'POST'
    )!;
    expect(await createRequest.json()).toEqual({
      fileId: 'file_123456789012345678901',
      name: 'Contract',
    });

    requests.length = 0;
    await client.templates.createFromFileId('file_abcdefghijklmnopqrstu', { name: 'Existing' });
    await client.templates.replaceFromFileId('tmpl_1', 'file_abcdefghijklmnopqrstu');
    expect(requests).toHaveLength(2);
    expect(requests.some((request) => request.url.includes('/v1/files'))).toBe(false);
    expect(await requests[0]!.json()).toEqual({
      fileId: 'file_abcdefghijklmnopqrstu',
      name: 'Existing',
    });
    expect(await requests[1]!.json()).toEqual({ fileId: 'file_abcdefghijklmnopqrstu' });

    const downloaded = await client.templates.download('tmpl_1', { revisionId: 'tmpr_1' });
    expect(downloaded).toBeInstanceOf(Blob);
    expect(asTemplateBytes(downloaded).size).toBeGreaterThan(0);
    expect(await downloaded.text()).toBe('template-bytes');
    expect(requests.at(-1)!.url).toContain('/v1/templates/tmpl_1/content?revisionId=tmpr_1');
  });

  test('public facade owns file upload helpers and omits staging', () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: (async () => new Response('{}')) as typeof globalThis.fetch,
      maxRetries: 0,
    });
    expect(typeof client.templates.create).toBe('function');
    expect(typeof client.templates.replace).toBe('function');
    expect(typeof client.templates.createFromFileId).toBe('function');
    expect(typeof client.templates.replaceFromFileId).toBe('function');
    expect(typeof client.templates.download).toBe('function');
    expect('staging' in client.templates).toBe(false);

    const docs = readFileSync(join(import.meta.dir, '../docs/reference.md'), 'utf8');
    expect(docs).toContain('### `client.templates.create`');
    expect(docs).toContain('### `client.templates.replace`');
    expect(docs).toContain('createFromFileId');
    expect(docs).toContain('replaceFromFileId');
    expect(docs).not.toContain('client.templates.staging');
  });

  test('cleans up a successful temporary upload after caller cancellation', async () => {
    const controller = new AbortController();
    const requests: Request[] = [];
    const fetch = (async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      requests.push(request.clone());
      if (request.url.endsWith('/v1/files/uploads')) {
        return Response.json({
          transport: 'multipart',
          url: '/v1/files',
          maxFileSizeBytes: 50_000_000,
        });
      }
      if (request.url.endsWith('/v1/files') && request.method === 'POST') {
        controller.abort();
        return Response.json({ id: 'file_123456789012345678901' });
      }
      if (request.url.includes('/v1/files/file_') && request.method === 'DELETE') {
        expect(request.signal.aborted).toBe(false);
        return Response.json({ deleted: true });
      }
      throw new DOMException('The operation was aborted', 'AbortError');
    }) as typeof globalThis.fetch;
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await expect(
      client.templates.create(new File(['doc'], 'contract.docx'), {
        signal: controller.signal,
      })
    ).rejects.toThrow();

    const cleanup = requests.find(
      (request) => request.url.includes('/v1/files/file_') && request.method === 'DELETE'
    );
    expect(cleanup).toBeDefined();
    expect(cleanup!.signal.aborted).toBe(false);
  });
});
