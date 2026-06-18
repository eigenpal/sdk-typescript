import { describe, expect, test } from 'bun:test';
import {
  EigenpalAuthError,
  EigenpalClient,
  EigenpalNotFoundError,
  EigenpalRateLimitError,
  EigenpalValidationError,
} from '../src';

interface MockResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function mockFetch(
  responses: MockResponse[],
  capturedRequests?: {
    url: string;
    method: string;
    auth: string | null;
    body?: string;
    headers?: Record<string, string>;
  }[]
): typeof globalThis.fetch {
  let i = 0;
  return async (input: Request | string | URL): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input.toString());
    const r = responses[i] ?? responses[responses.length - 1];
    if (i < responses.length - 1) i += 1;
    if (capturedRequests) {
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
      capturedRequests.push({
        url: req.url,
        method: req.method,
        auth: req.headers.get('Authorization'),
        body: req.body ? await req.text() : undefined,
        headers,
      });
    }
    return new Response(r.body !== undefined ? JSON.stringify(r.body) : null, {
      status: r.status,
      headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
    });
  };
}

describe('EigenpalClient public SDK', () => {
  test('attaches bearer auth and telemetry headers', async () => {
    const captured: { auth: string | null; headers?: Record<string, string> }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test_key_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([{ status: 200, body: { data: [] } }], captured),
      maxRetries: 0,
    });

    await client.automations.list();

    expect(captured[0]?.auth).toBe('Bearer eg_test_key_123');
    expect(captured[0]?.headers?.['x-eigenpal-sdk']).toBe('typescript');
    expect(captured[0]?.headers?.['user-agent']).toStartWith('eigenpal-sdk-typescript/');
  });

  test('client.run sends the canonical public run envelope', async () => {
    const captured: { url: string; method: string; body?: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [{ status: 201, body: { id: 'run_abc', type: 'workflow', finished: false } }],
        captured
      ),
      maxRetries: 0,
    });

    const result = await client.run(
      'workflows.extract-invoice@1.2.3',
      { language: 'en' },
      { metadata: { requestId: 'req_1' } }
    );

    expect(result.id).toBe('run_abc');
    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.url).toContain('/api/v1/runs');
    expect(captured[0]?.url).toContain('version=1.2.3');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({
      target: 'workflows.extract-invoice',
      input: { language: 'en' },
      metadata: { requestId: 'req_1' },
    });
  });

  test('object targets preserve workflow and agent typed target strings', async () => {
    const captured: { body?: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          { status: 201, body: { id: 'run_workflow', type: 'workflow', finished: false } },
          { status: 201, body: { id: 'run_agent', type: 'agent', finished: false } },
        ],
        captured
      ),
      maxRetries: 0,
    });

    await client.run({ type: 'workflow', slug: 'finance/extract-invoice' });
    await client.run({ type: 'agent', slug: 'finance/invoice-agent' });

    expect(JSON.parse(captured[0]?.body ?? '{}').target).toBe('workflows.finance.extract-invoice');
    expect(JSON.parse(captured[1]?.body ?? '{}').target).toBe('agents.finance.invoice-agent');
  });

  test('client.run rejects options bag as second argument', async () => {
    const client = new EigenpalClient({ apiKey: 'eg_test', baseUrl: 'http://localhost:3000' });

    await expect(
      client.run('workflows.wf_xyz', { input: { foo: 'bar' }, waitForCompletion: 30 })
    ).rejects.toThrow(/as the third/i);
  });

  test('client.run rejects metadata in the input bag', async () => {
    const client = new EigenpalClient({ apiKey: 'eg_test', baseUrl: 'http://localhost:3000' });

    await expect(
      client.run('workflows.wf_xyz', { metadata: { requestId: 'req_1' } })
    ).rejects.toThrow(/as the third/i);
  });

  test('client.run accepts metadata as a third-argument option', async () => {
    const captured: { body?: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [{ status: 201, body: { id: 'run_meta', type: 'workflow', finished: false } }],
        captured
      ),
      maxRetries: 0,
    });

    const result = await client.run(
      'workflows.wf_xyz',
      { language: 'en' },
      { metadata: { requestId: 'req_1' } }
    );

    expect(result.id).toBe('run_meta');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({
      target: 'workflows.wf_xyz',
      input: { language: 'en' },
      metadata: { requestId: 'req_1' },
    });
  });

  test('automations, runs, files, artifacts, trace, and feedback use public routes', async () => {
    const captured: { url: string; method: string; body?: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          {
            status: 200,
            body: {
              ok: true,
              tenantId: 'org_1',
              tenantSlug: 'acme',
              tenantName: 'Acme',
              userId: 'user_1',
              keyId: 'key_1',
              email: 'dev@example.com',
              name: 'Dev',
              scope: ['*'],
              wildcardGranted: true,
            },
          },
          { status: 200, body: { data: [] } },
          { status: 200, body: { id: 'workflows.extract-invoice' } },
          { status: 200, body: { data: [] } },
          { status: 200, body: { triggers: [] } },
          { status: 200, body: { runs: [] } },
          {
            status: 200,
            body: { id: 'run_123', finished: true, execution: { status: 'completed' } },
          },
          { status: 200, body: { usage: null } },
          { status: 200, body: { steps: [] } },
          { status: 200, body: { events: [] } },
          { status: 200, body: { artifacts: [] } },
          { status: 200, body: { feedback: null } },
          { status: 200, body: { lines: [] } },
          { status: 201, body: { id: 'file_123', filename: 'input.txt' } },
          { status: 200, body: { id: 'file_123', filename: 'input.txt' } },
          { status: 204 },
        ],
        captured
      ),
      maxRetries: 0,
    });

    await client.auth.check();
    await client.automations.list();
    await client.automations.get('workflows.extract-invoice');
    await client.automations.versions('workflows.extract-invoice');
    await client.automations.triggers('workflows.extract-invoice');
    await client.runs.list({ type: 'workflow', status: 'completed' });
    await client.runs.get('run_123', { expand: ['usage', 'execution'] });
    await client.runs.usage('run_123');
    await client.runs.steps('run_123');
    await client.runs.events('run_123');
    await client.runs.artifacts.list('run_123');
    await client.runs.feedback.get('run_123');
    await client.runs.trace.get('run_123');
    await client.files.upload(new Blob(['hello'], { type: 'text/plain' }));
    await client.files.get('file_123');
    await client.files.delete('file_123');

    const paths = captured.map((req) => new URL(req.url).pathname);
    expect(paths).toContain('/api/v1/auth/check');
    expect(paths).toContain('/api/v1/automations');
    expect(paths).toContain('/api/v1/automations/workflows.extract-invoice');
    expect(paths).toContain('/api/v1/automations/workflows.extract-invoice/versions');
    expect(paths).toContain('/api/v1/automations/workflows.extract-invoice/triggers');
    expect(paths).toContain('/api/v1/runs');
    expect(paths).toContain('/api/v1/runs/run_123');
    expect(paths).toContain('/api/v1/runs/run_123/usage');
    expect(paths).toContain('/api/v1/runs/run_123/steps');
    expect(paths).toContain('/api/v1/runs/run_123/events');
    expect(paths).toContain('/api/v1/runs/run_123/artifacts');
    expect(paths).toContain('/api/v1/runs/run_123/feedback');
    expect(paths).toContain('/api/v1/runs/run_123/trace');
    expect(paths).toContain('/api/v1/files');
    expect(paths).toContain('/api/v1/files/file_123');
  });

  test('runs.cancel and client.rerun use public control routes', async () => {
    const captured: { url: string; method: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          { status: 200, body: { id: 'run_123', execution: { status: 'cancelled' } } },
          { status: 202, body: { id: 'run_456', type: 'workflow', finished: false } },
        ],
        captured
      ),
      maxRetries: 0,
    });

    await client.runs.cancel('run_123');
    await client.rerun('run_123', { waitForCompletion: 30 });

    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.url).toContain('/api/v1/runs/run_123/cancel');
    expect(captured[1]?.method).toBe('POST');
    expect(captured[1]?.url).toContain('/api/v1/runs/run_123/rerun');
    expect(captured[1]?.url).toContain('wait_for_completion=30');
  });

  test('401, 404, 429, and 400 responses map to typed errors', async () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([
        { status: 401, body: { issues: [{ field: '<root>', message: 'invalid' }] } },
        { status: 404, body: { issues: [{ field: '<root>', message: 'missing' }] } },
        {
          status: 429,
          body: { issues: [{ field: '<root>', message: 'rate' }] },
          headers: { 'retry-after': '12' },
        },
        { status: 400, body: { issues: [{ field: 'target', message: 'required' }] } },
      ]),
      maxRetries: 0,
    });

    await expect(client.automations.list()).rejects.toBeInstanceOf(EigenpalAuthError);
    await expect(client.automations.get('missing')).rejects.toBeInstanceOf(EigenpalNotFoundError);
    await expect(client.automations.list()).rejects.toBeInstanceOf(EigenpalRateLimitError);
    await expect(client.automations.list()).rejects.toBeInstanceOf(EigenpalValidationError);
  });

  test('retries retriable responses', async () => {
    const captured: { url: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          { status: 503, body: { issues: [{ field: '<root>', message: 'down' }] } },
          { status: 200, body: { data: [] } },
        ],
        captured
      ),
      maxRetries: 2,
    });

    const result = await client.automations.list();

    expect(result.data).toEqual([]);
    expect(captured).toHaveLength(2);
  });
});
