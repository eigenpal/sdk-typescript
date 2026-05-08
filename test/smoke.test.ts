import { describe, expect, test } from 'bun:test';
import {
  Eigenpal,
  EigenpalAuthError,
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
  capturedRequests?: { url: string; method: string; auth: string | null; body?: string }[]
): typeof globalThis.fetch {
  let i = 0;
  return async (input: Request | string | URL): Promise<Response> => {
    const req = input instanceof Request ? input : new Request(input.toString());
    const r = responses[i] ?? responses[responses.length - 1];
    if (i < responses.length - 1) i += 1;
    if (capturedRequests) {
      capturedRequests.push({
        url: req.url,
        method: req.method,
        auth: req.headers.get('Authorization'),
        body: req.body ? await req.text() : undefined,
      });
    }
    return new Response(r.body !== undefined ? JSON.stringify(r.body) : null, {
      status: r.status,
      headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
    });
  };
}

describe('Eigenpal SDK', () => {
  test('attaches Bearer auth header on every request', async () => {
    const captured: { auth: string | null }[] = [];
    const client = new Eigenpal({
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

  test('workflows.run returns executionId', async () => {
    const captured: { url: string; method: string; body?: string }[] = [];
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([{ status: 201, body: { executionId: 'exec_abc' } }], captured),
      maxRetries: 0,
    });

    const result = await client.workflows.run('wf_xyz', { foo: 'bar' });

    expect(result.executionId).toBe('exec_abc');
    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.url).toContain('/v1/workflows/wf_xyz/run');
    expect(JSON.parse(captured[0]?.body ?? '{}')).toEqual({ input: { foo: 'bar' } });
  });

  test('workflows.run with waitForCompletion adds query param', async () => {
    const captured: { url: string }[] = [];
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          {
            status: 201,
            body: { executionId: 'exec_abc', status: 'completed', result: { ok: true } },
          },
        ],
        captured
      ),
      maxRetries: 0,
    });

    const result = await client.workflows.run('wf_xyz', { x: 1 }, { waitForCompletion: 30 });

    expect(result.status).toBe('completed');
    expect(captured[0]?.url).toContain('wait_for_completion=30');
  });

  test('401 surfaces as EigenpalAuthError', async () => {
    const client = new Eigenpal({
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
    const client = new Eigenpal({
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
    const client = new Eigenpal({
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
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([{ status: 400, body: envelope }]),
      maxRetries: 0,
    });

    try {
      await client.workflows.run('wf_xyz');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EigenpalValidationError);
      expect((err as EigenpalValidationError).issues[0].field).toBe('body.input');
    }
  });

  test('runAndWait polls until terminal status', async () => {
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch([
        // 1: trigger run
        { status: 201, body: { executionId: 'exec_pq' } },
        // 2: poll — running
        {
          status: 200,
          body: { executionId: 'exec_pq', status: 'running', createdAt: '2025-01-01T00:00:00Z' },
        },
        // 3: poll — completed
        {
          status: 200,
          body: {
            executionId: 'exec_pq',
            status: 'completed',
            result: { total: 42 },
            createdAt: '2025-01-01T00:00:00Z',
            completedAt: '2025-01-01T00:00:05Z',
          },
        },
      ]),
      maxRetries: 0,
    });

    const result = await client.executions.runAndWait(
      'wf_abc',
      { x: 1 },
      { pollIntervalMs: 5, timeoutMs: 5000 }
    );

    expect(result.executionId).toBe('exec_pq');
    expect(result.status).toBe('completed');
    expect(result.result).toEqual({ total: 42 });
  });

  test('executions.cancel hits the cancel endpoint', async () => {
    const captured: { url: string; method: string }[] = [];
    const client = new Eigenpal({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(
        [
          {
            status: 200,
            body: { executionId: 'exec_pq', status: 'cancelled', wasStatus: 'pending' },
          },
        ],
        captured
      ),
      maxRetries: 0,
    });

    const r = await client.executions.cancel('exec_pq');
    expect(r.status).toBe('cancelled');
    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.url).toContain('/v1/executions/exec_pq/cancel');
  });

  test('retries on 503 then succeeds', async () => {
    const captured: { url: string }[] = [];
    const client = new Eigenpal({
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
    const client = new Eigenpal({
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
      const client = new Eigenpal({ baseUrl: 'http://localhost:3000' });
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
      expect(() => new Eigenpal({ baseUrl: 'http://localhost:3000' })).toThrow(/EIGENPAL_API_KEY/);
    } finally {
      if (original !== undefined) process.env.EIGENPAL_API_KEY = original;
    }
  });
});
