import { describe, expect, test } from 'bun:test';
import { Eigenpal } from '../src';

/**
 * Tests for multipart file upload — exercises the `-F`-style path the SDK
 * takes whenever `workflows.run`'s input contains a `File`, `Blob`, or
 * `{ content, filename, mimeType }` descriptor.
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
    return new Response(JSON.stringify({ executionId: 'exec_abc' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, captured };
}

describe('multipart file upload', () => {
  test('Blob input switches to multipart/form-data', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/pdf' });
    await client.workflows.run('wf_xyz', { contract_document: blob, language: 'en' });

    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(captured[0]?.body).toContain('contract_document');
    // Non-file scalar travels in the _json sidecar (not as a top-level field).
    expect(captured[0]?.body).toContain('_json');
    expect(captured[0]?.body).toContain('"language":"en"');
  });

  test('File input preserves filename', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    const file = new File([new Uint8Array([1, 2, 3])], 'invoice.pdf', {
      type: 'application/pdf',
    });
    await client.workflows.run('wf_xyz', { invoice: file });

    expect(captured[0]?.contentType).toMatch(/^multipart\/form-data/);
    expect(captured[0]?.body).toContain('filename="invoice.pdf"');
  });

  test('explicit FileDescriptor works with raw bytes', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    await client.workflows.run('wf_xyz', {
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
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    await client.workflows.run('wf_xyz', { language: 'en' });

    expect(captured[0]?.contentType).toBe('application/json');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({ input: { language: 'en' } });
  });

  test('multiple files all appear in the form data', async () => {
    const { fetch, captured } = await captureRequest();
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch,
      maxRetries: 0,
    });

    const a = new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' });
    const b = new File([new Uint8Array([2])], 'b.pdf', { type: 'application/pdf' });
    await client.workflows.run('wf_xyz', { primary: a, secondary: b });

    expect(captured[0]?.body).toContain('filename="a.pdf"');
    expect(captured[0]?.body).toContain('filename="b.pdf"');
  });
});
