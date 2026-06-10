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
    return new Response(JSON.stringify({ runId: 'exec_abc', type: 'workflow' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, captured };
}

describe('multipart file upload', () => {
  test('Blob input switches to multipart/form-data', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/pdf' });
    await client.run('workflows.wf_xyz', { contract_document: blob, language: 'en' });

    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(captured[0]?.body).toContain('contract_document');
    // Non-file scalar travels in the _json sidecar (not as a top-level field).
    expect(captured[0]?.body).toContain('_json');
    expect(captured[0]?.body).toContain('"language":"en"');
    expect(captured[0]?.url).toContain('/api/v1/run/workflows.wf_xyz');
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
    await client.run('workflows.wf_xyz', { input: { invoice: file } });

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
      input: {
        contract: {
          content: buffer,
          filename: 'contract.pdf',
          mimeType: 'application/pdf',
        },
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

    await client.run('workflows.wf_xyz', { input: { language: 'en' } });

    expect(captured[0]?.contentType).toBe('application/json');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({ language: 'en' });
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
    await client.run('workflows.wf_xyz', { input: { contract_document: stream } });

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
      input: {
        contract: toFile(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'contract.pdf'),
      },
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
    await client.run('workflows.wf_xyz', { input: { primary: a, secondary: b } });

    expect(captured[0]?.body).toContain('filename="a.pdf"');
    expect(captured[0]?.body).toContain('filename="b.pdf"');
  });
});
