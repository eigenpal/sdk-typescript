import { describe, expect, test } from 'bun:test';
import { Readable } from 'node:stream';
import { EigenpalClient, toFile } from '../src';

/**
 * Tests for multipart file upload — exercises the `-F`-style path the SDK
 * takes whenever `client.run`'s input contains a Node readable stream, a
 * `File` / `Blob`, or a `{ content, filename, mimeType }` descriptor.
 */

interface CapturedRequest {
  url: string;
  method: string;
  contentType: string | null;
  body: string;
}

async function captureRequest(): Promise<{
  fetch: typeof globalThis.fetch;
  captured: CapturedRequest[];
}> {
  const captured: CapturedRequest[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const req = input instanceof Request ? input : new Request(input.toString());
    captured.push({
      url: req.url,
      method: req.method,
      contentType: req.headers.get('content-type'),
      body: req.body ? await req.text() : '',
    });
    if (req.url.endsWith('/v1/files/uploads')) {
      return Response.json({
        transport: 'multipart',
        url: '/v1/files',
        maxFileSizeBytes: 100 * 1024 * 1024,
      });
    }
    return new Response(JSON.stringify({ id: 'exec_abc', type: 'workflow', finished: false }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, captured };
}

describe('multipart file upload', () => {
  test('client.files.upload sends bytes directly without leaking API auth', async () => {
    const originalFetch = globalThis.fetch;
    let storageAuthorization: string | null = null;
    globalThis.fetch = (async (input, init) => {
      storageAuthorization = new Headers(init?.headers).get('authorization');
      expect(String(input)).toBe('https://storage.example/pending');
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    try {
      const apiFetch = (async (input) => {
        const request = input instanceof Request ? input : new Request(input.toString());
        if (request.url.endsWith('/v1/files/uploads')) {
          return Response.json({
            transport: 'presigned-put',
            uploadId: 'fup_1',
            fileId: 'file_1',
            url: 'https://storage.example/pending',
            headers: {
              'Content-Type': 'text/plain',
              'Content-Length': '5',
              'x-amz-meta-upload-id': 'fup_1',
            },
            expiresAt: '2026-08-04T10:00:00.000Z',
            maxFileSizeBytes: 100 * 1024 * 1024,
          });
        }
        if (request.url.endsWith('/v1/files/uploads/fup_1/complete')) {
          return Response.json({
            id: 'file_1',
            filename: 'input.txt',
            contentType: 'text/plain',
            size: 5,
            createdAt: '2026-08-04T09:00:00.000Z',
          });
        }
        throw new Error(`Unexpected API request: ${request.url}`);
      }) as typeof fetch;
      const client = new EigenpalClient({
        apiKey: 'eg_test',
        baseUrl: 'http://localhost:3000',
        fetch: apiFetch,
        maxRetries: 0,
      });

      const result = await client.files.upload(
        new File(['hello'], 'input.txt', { type: 'text/plain' })
      );

      expect(result.id).toBe('file_1');
      expect(storageAuthorization).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('client.files.upload sends raw multipart form data', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.files.upload(new File(['hello'], 'input.txt', { type: 'text/plain' }));

    expect(captured[0]?.url).toContain('/v1/files/uploads');
    expect(captured[1]?.method).toBe('POST');
    expect(captured[1]?.url).toContain('/v1/files');
    expect(captured[1]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(captured[1]?.body).toContain('name="file"');
    expect(captured[1]?.body).toContain('filename="input.txt"');
    expect(captured[1]?.body).not.toContain('[object FormData]');
  });

  test('client.automations.dataset.import sends raw multipart form data', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.automations.dataset.import(
      'workflows.extract-invoice',
      new File(['zip'], 'dataset.zip', { type: 'application/zip' }),
      { mode: 'replace' }
    );

    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.url).toContain('/v1/automations/workflows.extract-invoice/dataset/import');
    expect(captured[0]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(captured[0]?.body).toContain('name="file"');
    expect(captured[0]?.body).toContain('filename="dataset.zip"');
    expect(captured[0]?.body).toContain('name="mode"');
    expect(captured[0]?.body).toContain('replace');
    expect(captured[0]?.body).not.toContain('[object FormData]');
  });

  test('Blob input switches to multipart/form-data', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/pdf' });
    await client.run(
      'workflows.wf_xyz',
      { contract_document: blob, language: 'en' },
      { metadata: { requestId: 'req_1' } }
    );

    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(captured[0]?.body).toContain('files.contract_document');
    // Non-file scalar travels in the canonical `input` JSON part.
    expect(captured[0]?.body).toContain('name="input"');
    expect(captured[0]?.body).not.toContain('_json');
    expect(captured[0]?.body).toContain('"language":"en"');
    expect(captured[0]?.body).toContain('name="metadata"');
    expect(captured[0]?.body).toContain('"requestId":"req_1"');
    expect(captured[0]?.body).toContain('target');
    expect(captured[0]?.body).toContain('workflows.wf_xyz');
    expect(captured[0]?.url).toContain('/v1/runs');
    expect(captured[0]?.url).not.toContain('%40');
  });

  test('File input preserves filename', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    const file = new File([new Uint8Array([1, 2, 3])], 'invoice.pdf', {
      type: 'application/pdf',
    });
    await client.run('workflows.wf_xyz', { invoice: file });

    expect(captured[0]?.contentType).toMatch(/^multipart\/form-data/);
    expect(captured[0]?.body).toContain('filename="invoice.pdf"');
  });

  test('explicit FileDescriptor works with raw bytes', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    await client.run('workflows.wf_xyz', {
      contract: {
        content: buffer,
        filename: 'contract.pdf',
        mimeType: 'application/pdf',
      },
    });

    expect(captured[0]?.contentType).toMatch(/^multipart\/form-data/);
    expect(captured[0]?.body).toContain('filename="contract.pdf"');
    expect(captured[0]?.body).toContain('Content-Type: application/pdf');
  });

  test('no files → JSON body, no multipart switch', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.run('workflows.wf_xyz', { language: 'en' });

    expect(captured[0]?.contentType).toBe('application/json');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({
      target: 'workflows.wf_xyz',
      input: { language: 'en' },
    });
  });

  test('Node readable stream uploads as multipart with the filename from its path', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    // A `fs.createReadStream`-shaped value: async-iterable readable + `path`.
    const stream = Readable.from([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
    (stream as unknown as { path: string }).path = '/tmp/uploads/contract.pdf';
    await client.run('workflows.wf_xyz', { contract_document: stream });

    expect(captured[0]?.contentType).toMatch(/^multipart\/form-data/);
    // Filename is the basename of the stream's path.
    expect(captured[0]?.body).toContain('filename="contract.pdf"');
    expect(captured[0]?.body).toContain('Content-Type: application/pdf');
  });

  test('toFile attaches a filename + inferred MIME type to raw bytes', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.run('workflows.wf_xyz', {
      contract: toFile(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'contract.pdf'),
    });

    expect(captured[0]?.contentType).toMatch(/^multipart\/form-data/);
    expect(captured[0]?.body).toContain('filename="contract.pdf"');
    // MIME type inferred from the `.pdf` extension.
    expect(captured[0]?.body).toContain('Content-Type: application/pdf');
  });

  test('multiple files all appear in the form data', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    const a = new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' });
    const b = new File([new Uint8Array([2])], 'b.pdf', { type: 'application/pdf' });
    await client.run('workflows.wf_xyz', { primary: a, secondary: b });

    expect(captured[0]?.body).toContain('filename="a.pdf"');
    expect(captured[0]?.body).toContain('filename="b.pdf"');
  });

  test('createUpload sends a reusable idempotencyKey', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.files.createUpload({
      filename: 'input.txt',
      contentType: 'text/plain',
      size: 5,
      idempotencyKey: 'idem_fixed_1',
    });

    expect(captured[0]?.url).toContain('/v1/files/uploads');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toMatchObject({
      filename: 'input.txt',
      contentType: 'text/plain',
      size: 5,
      idempotencyKey: 'idem_fixed_1',
    });
  });

  test('files.upload generates an idempotencyKey for session creation', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.files.upload(new File(['hello'], 'input.txt', { type: 'text/plain' }));

    const createBody = JSON.parse(captured[0]?.body ?? '{}') as { idempotencyKey?: string };
    expect(typeof createBody.idempotencyKey).toBe('string');
    expect(createBody.idempotencyKey!.length).toBeGreaterThan(8);
  });

  test('large run file inputs pre-upload via Files and send $fileId JSON', async () => {
    const captured: CapturedRequest[] = [];
    const large = new Uint8Array(5 * 1024 * 1024);
    large.fill(1);
    const fetch: typeof globalThis.fetch = async (input) => {
      const req = input instanceof Request ? input : new Request(input.toString());
      captured.push({
        url: req.url,
        method: req.method,
        contentType: req.headers.get('content-type'),
        body: req.body ? await req.text() : '',
      });
      if (req.url.endsWith('/v1/files/uploads')) {
        return Response.json({
          transport: 'multipart',
          url: '/api/v1/files',
          maxFileSizeBytes: 100 * 1024 * 1024,
        });
      }
      if (req.url.endsWith('/api/v1/files')) {
        return Response.json({
          id: 'file_large',
          filename: 'big.bin',
          contentType: 'application/octet-stream',
          size: large.byteLength,
          createdAt: '2026-08-04T09:00:00.000Z',
        });
      }
      return new Response(JSON.stringify({ id: 'exec_abc', type: 'workflow', finished: false }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    };

    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.run('workflows.wf_xyz', {
      document: new File([large], 'big.bin', { type: 'application/octet-stream' }),
      language: 'en',
    });

    expect(captured.some((req) => req.url.includes('/v1/files/uploads'))).toBe(true);
    expect(captured.some((req) => req.url.endsWith('/api/v1/files'))).toBe(true);
    const createReq = captured.find((req) => req.url.endsWith('/v1/files/uploads'));
    expect(JSON.parse(createReq?.body ?? '{}')).toMatchObject({ purpose: 'run-input' });
    const runReq = captured.find((req) => req.url.includes('/v1/runs'));
    expect(runReq?.contentType).toBe('application/json');
    expect(JSON.parse(runReq?.body ?? '{}')).toEqual({
      target: 'workflows.wf_xyz',
      input: {
        document: { $fileId: 'file_large' },
        language: 'en',
      },
    });
  });

  test('multipartMaxBytes null keeps large run files on multipart', async () => {
    const captured: CapturedRequest[] = [];
    const fetch: typeof globalThis.fetch = async (input) => {
      const req = input instanceof Request ? input : new Request(input.toString());
      captured.push({
        url: req.url,
        method: req.method,
        contentType: req.headers.get('content-type'),
        body: req.body ? await req.text() : '',
      });
      return new Response(
        JSON.stringify({ id: 'exec_multipart', type: 'workflow', finished: false }),
        {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }
      );
    };
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
      multipartMaxBytes: null,
    });

    await client.run('workflows.wf_xyz', {
      document: new File([new Uint8Array(5 * 1024 * 1024)], 'big.bin'),
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toContain('/v1/runs');
    expect(captured[0]?.contentType).toStartWith('multipart/form-data');
  });

  test('explicit files.upload omits purpose so the file stays reusable', async () => {
    const captured: CapturedRequest[] = [];
    const fetch: typeof globalThis.fetch = async (input) => {
      const req = input instanceof Request ? input : new Request(input.toString());
      captured.push({
        url: req.url,
        method: req.method,
        contentType: req.headers.get('content-type'),
        body: req.body ? await req.text() : '',
      });
      if (req.url.endsWith('/v1/files/uploads')) {
        return Response.json({
          transport: 'multipart',
          url: '/v1/files',
          maxFileSizeBytes: 100 * 1024 * 1024,
        });
      }
      return Response.json({
        id: 'file_keep',
        filename: 'input.txt',
        contentType: 'text/plain',
        size: 5,
        purpose: null,
        createdAt: '2026-08-04T09:00:00.000Z',
      });
    };

    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.files.upload(new File(['hello'], 'input.txt', { type: 'text/plain' }));
    const createBody = JSON.parse(captured[0]?.body ?? '{}') as { purpose?: string };
    expect(createBody.purpose).toBeUndefined();
  });

  test('two mid-size files that exceed the aggregate budget pre-upload enough via Files', async () => {
    const captured: CapturedRequest[] = [];
    let fileSeq = 0;
    const threeMiB = new Uint8Array(3 * 1024 * 1024);
    threeMiB.fill(7);
    const fetch: typeof globalThis.fetch = async (input) => {
      const req = input instanceof Request ? input : new Request(input.toString());
      captured.push({
        url: req.url,
        method: req.method,
        contentType: req.headers.get('content-type'),
        body: req.body ? await req.text() : '',
      });
      if (req.url.endsWith('/v1/files/uploads')) {
        return Response.json({
          transport: 'multipart',
          url: '/v1/files',
          maxFileSizeBytes: 100 * 1024 * 1024,
        });
      }
      if (req.url.endsWith('/v1/files')) {
        fileSeq += 1;
        return Response.json({
          id: `file_${fileSeq}`,
          filename: `part-${fileSeq}.bin`,
          contentType: 'application/octet-stream',
          size: threeMiB.byteLength,
          createdAt: '2026-08-04T09:00:00.000Z',
        });
      }
      return new Response(JSON.stringify({ id: 'exec_abc', type: 'workflow', finished: false }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    };

    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.run('workflows.wf_xyz', {
      primary: new File([threeMiB], 'primary.bin', { type: 'application/octet-stream' }),
      secondary: new File([threeMiB], 'secondary.bin', { type: 'application/octet-stream' }),
      language: 'en',
    });

    // At least one file must leave the run request via Files (aggregate > budget).
    expect(captured.filter((req) => req.url.endsWith('/v1/files')).length).toBeGreaterThanOrEqual(
      1
    );
    const runReq = captured.find((req) => req.url.includes('/v1/runs'));
    expect(runReq).toBeDefined();
    const runBody = runReq!.body;
    // One side is a $fileId JSON reference; the other may remain multipart.
    const hasFileId =
      runBody.includes('"$fileId":"file_1"') || runBody.includes('"$fileId": "file_1"');
    expect(hasFileId).toBe(true);
    if (runReq!.contentType?.startsWith('multipart/form-data')) {
      expect(runBody).toMatch(/filename="(primary|secondary)\.bin"/);
    } else {
      // Both files were pre-uploaded — run is pure JSON with two $fileId refs.
      expect(runReq!.contentType).toBe('application/json');
      const parsed = JSON.parse(runBody) as {
        input: { primary: { $fileId: string }; secondary: { $fileId: string } };
      };
      expect(parsed.input.primary.$fileId).toMatch(/^file_/);
      expect(parsed.input.secondary.$fileId).toMatch(/^file_/);
    }
  });

  test('files.download accepts normal file MIME types as binary', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: async () =>
        new Response(bytes, {
          headers: { 'content-type': 'application/pdf' },
        }),
    });

    const downloaded = await client.files.download('file_pdf');
    expect(downloaded).toBeInstanceOf(Blob);
    expect(downloaded.type).toBe('application/pdf');
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(bytes);
  });

  test('files.download still rejects HTML from a misconfigured API host', async () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: async () =>
        new Response('<html>wrong host</html>', {
          headers: { 'content-type': 'text/html' },
        }),
    });

    await expect(client.files.download('file_pdf')).rejects.toThrow(
      'Expected a binary response from the API'
    );
  });
});
