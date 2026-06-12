import { describe, expect, test } from 'bun:test';
import {
  EigenpalAuthError,
  EigenpalClient,
  EigenpalNotFoundError,
  EigenpalRateLimitError,
  EigenpalValidationError,
} from '../src';

/**
 * Smoke tests against a mocked fetch — verifies the SDK wires auth, retries,
 * pagination, and typed errors correctly without needing a live server.
 */

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

describe('EigenpalClient SDK', () => {
  test('attaches Bearer auth header on every request', async () => {
    const captured: { auth: string | null }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test_key_123',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [{ status: 200, body: { data: [], total: 0, limit: 50, offset: 0 } }],
        captured
      ),
      maxRetries: 0,
    });

    await client.workflows.list();

    expect(captured[0]?.auth).toBe('Bearer eg_test_key_123');
  });

  test('client.run returns id', async () => {
    const captured: { url: string; method: string; body?: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [{ status: 201, body: { id: 'exec_abc', type: 'workflow', finished: false } }],
        captured
      ),
      maxRetries: 0,
    });

    const result = await client.run('workflows.wf_xyz', { foo: 'bar' });

    expect(result.id).toBe('exec_abc');
    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.url).toContain('/api/v1/runs');
    expect(captured[0]?.url).not.toContain('%40');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({
      target: 'workflows.wf_xyz',
      input: { foo: 'bar' },
    });
  });

  test('client.run rejects options bag as second argument', async () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
    });

    await expect(
      client.run('workflows.wf_xyz', { input: { foo: 'bar' }, waitForCompletion: 30 })
    ).rejects.toThrow(/as the third/i);
  });

  test('client.run accepts documented input and options arguments', async () => {
    const captured: { url: string; method: string; body?: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [{ status: 200, body: { id: 'exec_abc', type: 'workflow', finished: true } }],
        captured
      ),
      maxRetries: 0,
    });

    const result = await client.run('workflows.wf_xyz', { foo: 'bar' }, { waitForCompletion: 30 });

    expect(result.id).toBe('exec_abc');
    expect(captured[0]?.url).toContain('wait_for_completion=30');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({
      target: 'workflows.wf_xyz',
      input: { foo: 'bar' },
    });
  });

  test('client.run object targets mirror canonical run-target grammar', async () => {
    const captured: { url: string; method: string; body?: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          { status: 201, body: { id: 'exec_workflow', type: 'workflow', finished: false } },
          { status: 201, body: { id: 'exec_agent', type: 'agent', finished: false } },
          { status: 201, body: { id: 'exec_agent_rooted', type: 'agent', finished: false } },
        ],
        captured
      ),
      maxRetries: 0,
    });

    await client.run({ type: 'workflow', slug: 'finance/extract-invoice', version: '1.2.3' });
    await client.run({ type: 'agent', slug: 'finance/invoice-agent', version: 'main' });
    await client.run({ type: 'agent', slug: 'agents.finance.invoice-agent' });

    expect(captured[0]?.url).toContain('/api/v1/runs');
    expect(captured[0]?.url).toContain('version=1.2.3');
    expect(JSON.parse(captured[0]?.body ?? '{}').target).toBe('workflows.finance.extract-invoice');
    expect(captured[1]?.url).toContain('/api/v1/runs');
    expect(captured[1]?.url).toContain('version=main');
    expect(JSON.parse(captured[1]?.body ?? '{}').target).toBe('agents.finance.invoice-agent');
    expect(captured[2]?.url).toContain('/api/v1/runs');
    expect(JSON.parse(captured[2]?.body ?? '{}').target).toBe('agents.finance.invoice-agent');
  });

  test('client.run rejects ambiguous rooted agent object targets', async () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
    });

    await expect(client.run({ type: 'agent', slug: 'workflows.extract-invoice' })).rejects.toThrow(
      /rooted at "agents\."/i
    );
  });

  test('client.run sends overrides in the canonical envelope body', async () => {
    const captured: { url: string; method: string; body?: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [{ status: 201, body: { id: 'exec_ov', type: 'workflow', finished: false } }],
        captured
      ),
      maxRetries: 0,
    });

    const overrides = { steps: { extract: { total: 42 } } };
    const result = await client.run('workflows.wf_xyz', { language: 'en' }, { overrides });

    expect(result.id).toBe('exec_ov');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({
      target: 'workflows.wf_xyz',
      input: { language: 'en' },
      overrides,
    });
  });

  test('client.run with waitForCompletion adds query param', async () => {
    const captured: { url: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          {
            status: 200,
            body: {
              id: 'exec_abc',
              type: 'workflow',
              finished: true,
              output: { ok: true },
              execution: { status: 'completed', schemaValid: true },
            },
          },
        ],
        captured
      ),
      maxRetries: 0,
    });

    const result = await client.run('workflows.wf_xyz', { x: 1 }, { waitForCompletion: 30 });

    expect(result.finished).toBe(true);
    expect(result.output).toEqual({ ok: true });
    expect(captured[0]?.url).toContain('wait_for_completion=30');
  });

  test('agents.update hits the update endpoint with JSON body', async () => {
    const captured: { url: string; method: string; body?: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          {
            status: 200,
            body: {
              agent: {
                id: 'awf_123',
                slug: 'invoice-agent',
                name: 'Invoice Agent',
                description: 'Updated',
                config: { triggers: { api: { enabled: true } } },
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
              },
            },
          },
        ],
        captured
      ),
      maxRetries: 0,
    });

    const result = await client.agents.update('invoice-agent', {
      description: 'Updated',
      config: { triggers: { api: { enabled: true } } },
    });

    expect(result.agent.description).toBe('Updated');
    expect(captured[0]?.method).toBe('PATCH');
    expect(captured[0]?.url).toContain('/api/v1/agents/invoice-agent');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({
      description: 'Updated',
      config: { triggers: { api: { enabled: true } } },
    });
  });

  test('runs resource uses the public v1 runs API', async () => {
    const captured: { url: string; method: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          { status: 200, body: { runs: [], nextCursor: null } },
          {
            status: 200,
            body: {
              id: 'run_123',
              type: 'workflow',
              finished: true,
              source: { id: 'wf_123', name: 'Extract' },
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          },
          { status: 200, body: { ok: true } },
          { status: 201, body: { id: 'run_rerun', type: 'workflow', finished: false } },
          { status: 200, body: { ok: true } },
          { status: 200, body: { expected: null, files: [] } },
        ],
        captured
      ),
      maxRetries: 0,
    });

    await client.runs.list({ type: 'workflow', source: 'wf_123', status: 'completed' });
    const run = await client.runs.get('run_123', { expand: ['usage', 'execution'] });
    await client.runs.cancel('run_123');
    await client.rerun('run_123');
    await client.runs.feedback.update('run_123', { status: 'open' });
    await client.runs.expected.list('run_123');

    expect(run.id).toBe('run_123');
    expect(captured[0]?.url).toContain('/api/v1/runs');
    expect(captured[0]?.url).toContain('type=workflow');
    expect(captured[1]?.url).toContain('/api/v1/runs/run_123');
    expect(captured[1]?.url).toContain('expand=usage%2Cexecution');
    expect(captured[2]?.method).toBe('POST');
    expect(captured[2]?.url).toContain('/api/v1/runs/run_123/cancel');
    expect(captured[3]?.method).toBe('POST');
    expect(captured[3]?.url).toContain('/api/v1/runs/run_123/rerun');
    expect(captured[4]?.method).toBe('PATCH');
    expect(captured[4]?.url).toContain('/api/v1/runs/run_123/feedback');
    expect(captured[5]?.method).toBe('GET');
    expect(captured[5]?.url).toContain('/api/v1/runs/run_123/expected');
  });

  test('runs.artifacts.download preserves slash-delimited artifact paths', async () => {
    const captured: { url: string; method: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([{ status: 200 }], captured),
      maxRetries: 0,
    });

    await client.runs.artifacts.download('run_123', 'output/file_123');

    expect(captured[0]?.method).toBe('GET');
    expect(captured[0]?.url).toContain('/api/v1/runs/run_123/artifacts/output/file_123');
    expect(captured[0]?.url).not.toContain('output%2Ffile_123');
  });

  test('401 surfaces as EigenpalAuthError', async () => {
    const client = new EigenpalClient({
      apiKey: 'bad',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([
        {
          status: 401,
          body: {
            issues: [{ field: '<root>', message: 'invalid', code: 'unauthorized' }],
            requestId: 'r1',
          },
        },
      ]),
      maxRetries: 0,
    });

    await expect(client.workflows.list()).rejects.toBeInstanceOf(EigenpalAuthError);
  });

  test('404 surfaces as EigenpalNotFoundError', async () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([
        {
          status: 404,
          body: {
            issues: [{ field: '<root>', message: 'Workflow not found', code: 'not_found' }],
            requestId: 'r2',
          },
        },
      ]),
      maxRetries: 0,
    });

    await expect(client.workflows.get('wf_missing')).rejects.toBeInstanceOf(EigenpalNotFoundError);
  });

  test('429 with Retry-After surfaces as EigenpalRateLimitError', async () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([
        {
          status: 429,
          body: {
            issues: [{ field: '<root>', message: 'rate limited', code: 'rate_limited' }],
            requestId: 'r3',
          },
          headers: { 'retry-after': '12' },
        },
      ]),
      maxRetries: 0,
    });

    try {
      await client.workflows.list();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EigenpalRateLimitError);
      expect((err as EigenpalRateLimitError).retryAfter).toBe(12);
    }
  });

  test('400 surfaces as EigenpalValidationError with issues', async () => {
    const envelope = {
      issues: [
        { field: 'body.input', message: 'required', code: 'required', severity: 'error' as const },
      ],
      requestId: 'r4',
    };
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([{ status: 400, body: envelope }]),
      maxRetries: 0,
    });

    try {
      await client.run('workflows.wf_xyz');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EigenpalValidationError);
      expect((err as EigenpalValidationError).issues[0].field).toBe('body.input');
    }
  });

  test('runAndWait polls until terminal status', async () => {
    const captured: { url: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          // 1: trigger run
          { status: 201, body: { id: 'exec_pq', type: 'workflow', finished: false } },
          // 2: poll — running
          {
            status: 200,
            body: {
              id: 'exec_pq',
              finished: false,
              execution: { status: 'running' },
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
          // 3: poll — completed
          {
            status: 200,
            body: {
              id: 'exec_pq',
              finished: true,
              output: { total: 42 },
              execution: { status: 'completed' },
              createdAt: '2025-01-01T00:00:00Z',
              completedAt: '2025-01-01T00:00:05Z',
            },
          },
        ],
        captured
      ),
      maxRetries: 0,
    });

    const result = await client.workflows.executions.runAndWait(
      'wf_abc',
      { x: 1 },
      { pollIntervalMs: 5, timeoutMs: 5000 }
    );

    expect(result.id).toBe('exec_pq');
    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ total: 42 });
    expect(captured[1]?.url).toContain('expand=execution');
    expect(captured[2]?.url).toContain('expand=execution');
  });

  test('runs.cancel cancels workflow runs through the public v1 runs API', async () => {
    const captured: { url: string; method: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          {
            status: 200,
            body: {
              id: 'exec_pq',
              type: 'workflow',
              finished: true,
              execution: { status: 'cancelled' },
              cancellation: { state: 'cancelled', wasStatus: 'pending' },
            },
          },
        ],
        captured
      ),
      maxRetries: 0,
    });

    const r = await client.runs.cancel('exec_pq');
    expect(r.execution.status).toBe('cancelled');
    expect(r.cancellation.state).toBe('cancelled');
    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.url).toContain('/api/v1/runs/exec_pq');
  });

  test('retries on 503 then succeeds', async () => {
    const captured: { url: string }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          {
            status: 503,
            body: {
              issues: [
                { field: '<root>', message: 'down', code: 'unavailable', severity: 'error' },
              ],
              requestId: 'r1',
            },
          },
          {
            status: 503,
            body: {
              issues: [
                { field: '<root>', message: 'down', code: 'unavailable', severity: 'error' },
              ],
              requestId: 'r2',
            },
          },
          { status: 200, body: { data: [], total: 0, limit: 50, offset: 0 } },
        ],
        captured
      ),
      maxRetries: 3,
    });

    const result = await client.workflows.list();
    expect(result.total).toBe(0);
    expect(captured.length).toBe(3); // 2 retries + final success
  });

  test('429 with Retry-After waits then retries', async () => {
    const captured: { url: string }[] = [];
    const start = Date.now();
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          {
            status: 429,
            body: {
              issues: [
                { field: '<root>', message: 'rate', code: 'rate_limited', severity: 'error' },
              ],
              requestId: 'r1',
            },
            headers: { 'retry-after': '1' },
          },
          { status: 200, body: { data: [], total: 0, limit: 50, offset: 0 } },
        ],
        captured
      ),
      maxRetries: 2,
    });

    const result = await client.workflows.list();
    expect(result.total).toBe(0);
    expect(captured.length).toBe(2);
    // Retry-After: 1 second was honored
    expect(Date.now() - start).toBeGreaterThanOrEqual(1000);
  }, 5000);

  test('reads EIGENPAL_API_KEY from env when apiKey omitted', () => {
    const original = process.env.EIGENPAL_API_KEY;
    process.env.EIGENPAL_API_KEY = 'eg_from_env';
    try {
      const client = new EigenpalClient({ baseUrl: 'http://localhost:3000' });
      expect(client.getRawClient().getConfig().headers).toBeDefined();
    } finally {
      if (original === undefined) delete process.env.EIGENPAL_API_KEY;
      else process.env.EIGENPAL_API_KEY = original;
    }
  });

  test('throws helpful error when no apiKey and no env', () => {
    const original = process.env.EIGENPAL_API_KEY;
    delete process.env.EIGENPAL_API_KEY;
    try {
      expect(() => new EigenpalClient({ baseUrl: 'http://localhost:3000' })).toThrow(
        /EIGENPAL_API_KEY/
      );
    } finally {
      if (original !== undefined) process.env.EIGENPAL_API_KEY = original;
    }
  });

  test('attaches X-Eigenpal-Sdk-* telemetry headers and a richer User-Agent', async () => {
    const captured: { headers?: Record<string, string> }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [{ status: 200, body: { data: [], total: 0, limit: 50, offset: 0 } }],
        captured
      ),
      maxRetries: 0,
    });
    await client.workflows.list();

    const h = captured[0]?.headers ?? {};
    expect(h['x-eigenpal-sdk']).toBe('typescript');
    expect(h['x-eigenpal-sdk-version']).toBeDefined();
    // Runtime tag is "node-X" / "bun-X" / "deno-X" / "browser"
    expect(h['x-eigenpal-sdk-runtime']).toMatch(/^(node|bun|deno|browser)/);
    expect(h['x-eigenpal-sdk-os']).toBeDefined();
    expect(h['user-agent']).toMatch(/^eigenpal-sdk-typescript\//);
  });

  test('user-supplied defaultHeaders override telemetry (opt-out path)', async () => {
    const captured: { headers?: Record<string, string> }[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      defaultHeaders: { 'User-Agent': 'my-custom-agent/1.0', 'X-Eigenpal-Sdk': 'unknown' },
      fetch: mockFetch(
        [{ status: 200, body: { data: [], total: 0, limit: 50, offset: 0 } }],
        captured
      ),
      maxRetries: 0,
    });
    await client.workflows.list();

    const h = captured[0]?.headers ?? {};
    expect(h['user-agent']).toBe('my-custom-agent/1.0');
    expect(h['x-eigenpal-sdk']).toBe('unknown');
  });
});
