import { EigenpalError, EigenpalTimeoutError, errorFromResponse } from './errors';
import { createClient, createConfig, type Client, type Config } from './generated/client';
import type {
  ApiErrorEnvelope,
  RunStartResponse as GeneratedRunStartResponse,
  Run,
} from './generated/types.gen';
import { buildRunJsonBody, buildRunMultipart, hasFileInput } from './lib/files';
import { AuthResource } from './resources/auth';
import { AutomationsResource } from './resources/automations';
import { FilesResource } from './resources/files';
import { RunsResource } from './resources/runs';
import { buildTelemetryHeaders } from './telemetry';

export interface EigenpalOptions {
  /**
   * API key issued from Settings → API Keys (`eg_…`).
   *
   * Falls back to the `EIGENPAL_API_KEY` environment variable when omitted,
   * so most users only need `new EigenpalClient()`.
   */
  apiKey?: string;
  /**
   * Override the API base URL.
   *
   * Defaults to `EIGENPAL_BASE_URL` if set, otherwise `https://studio.eigenpal.com`.
   */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Defaults to 60_000. */
  timeoutMs?: number;
  /** How many times to retry on 5xx / 429 / network errors. Defaults to 3. */
  maxRetries?: number;
  /** Inject a custom fetch implementation (testing). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Extra headers attached to every request (debug ids, custom user-agent suffix, etc.). */
  defaultHeaders?: Record<string, string>;
}

const DEFAULT_BASE_URL = 'https://studio.eigenpal.com';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Result shape returned by hey-api operation calls. We let hey-api default
 * to `throwOnError: false` so we can centralize error mapping and retries
 * in `_request`. The `error` field carries the parsed `ApiErrorEnvelope`
 * for non-2xx responses; `data` is the success payload. `response` is
 * optional only because hey-api's types declare it that way — at runtime
 * it's always present once the fetch resolves.
 */
export interface OperationResult<T> {
  data?: T;
  error?: unknown;
  response?: Response;
  request?: Request;
}

export type RunTarget =
  | string
  | {
      type: 'workflow' | 'agent';
      id?: string;
      slug?: string;
      version?: string;
    };

export type RunInput = Record<string, unknown>;

/** Third argument to `client.run()` — transport knobs, not workflow/agent input. */
export interface RunCallOptions {
  waitForCompletion?: number;
  overrides?: { steps?: Record<string, Record<string, unknown>> };
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface RerunOptions {
  version?: 'latest' | 'original' | string;
  waitForCompletion?: number;
  signal?: AbortSignal;
}

/**
 * Run-start response — async bodies are `{ id, type, finished: false }` (201);
 * wait-expired bodies use the same shape (202); sync terminal completion matches
 * `client.runs.get(id)` (200).
 * Aliases the generated OpenAPI type so the handwritten and generated surfaces
 * can never diverge.
 */
export type RunStartResponse = GeneratedRunStartResponse;

/** Narrow `RunStartResponse` to a terminal run with `output` and related fields. */
export function isRunFinished(run: RunStartResponse): run is Run {
  return run.finished === true;
}

/**
 * The EigenPal SDK client.
 *
 * ```ts
 * import { EigenpalClient } from '@eigenpal/sdk';
 *
 * // Reads EIGENPAL_API_KEY from env automatically.
 * const client = new EigenpalClient();
 *
 * // Async — enqueue and poll later.
 * const { id } = await client.run('workflows.extract-invoice', { language: 'en' });
 *
 * // Sync (server holds the connection up to 60s).
 * const result = await client.run(
 *   'workflows.extract-invoice',
 *   { language: 'en' },
 *   { waitForCompletion: 60 }
 * );
 *
 * // Inspect the final run later.
 * const final = await client.runs.get(id);
 * ```
 */
export class EigenpalClient {
  /** API key identity and current tenant context. */
  public readonly auth: AuthResource;
  /** Automation metadata across workflows and agents. Start runs with `client.run(...)`. */
  public readonly automations: AutomationsResource;
  /** Tenant-wide run operations across workflow, agent, manual, and eval runs. */
  public readonly runs: RunsResource;
  /** Reusable uploaded files that can be referenced by later runs. */
  public readonly files: FilesResource;

  /** Underlying hey-api client. Use `getRawClient()` for advanced cases. */
  private readonly client: Client;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(options: EigenpalOptions = {}) {
    const apiKey = options.apiKey ?? readEnv('EIGENPAL_API_KEY');
    if (!apiKey) {
      throw new EigenpalError(
        'Missing API key. Pass `new EigenpalClient({ apiKey })` or set the EIGENPAL_API_KEY environment variable.',
        { status: 0 }
      );
    }

    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const baseUrl = options.baseUrl ?? readEnv('EIGENPAL_BASE_URL') ?? DEFAULT_BASE_URL;
    const config: Config = createConfig({
      baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // SDK telemetry headers (X-Eigenpal-Sdk-*) + a richer User-Agent.
        // User-supplied defaultHeaders override these so callers can opt out
        // of telemetry by passing their own User-Agent / X-Eigenpal-Sdk.
        ...buildTelemetryHeaders(),
        ...(options.defaultHeaders ?? {}),
      },
    });

    this.client = createClient(config);
    if (options.fetch) {
      // hey-api's Config types `fetch` as `typeof fetch` (DOM type that
      // includes `preconnect`). At runtime any `(Request) => Promise<Response>`
      // works; cast to bypass the structural mismatch.
      this.client.setConfig({ fetch: options.fetch as never });
    }
    this.installTimeoutInterceptor();

    this.auth = new AuthResource(this.client, this._request.bind(this));
    this.automations = new AutomationsResource(this.client, this._request.bind(this));
    this.runs = new RunsResource(this.client, this._request.bind(this));
    this.files = new FilesResource(this.client, this._request.bind(this));
  }

  /** Expose the underlying hey-api client for advanced use (custom interceptors, etc.). */
  getRawClient(): Client {
    return this.client;
  }

  async run(
    target: RunTarget,
    input?: RunInput,
    options: RunCallOptions = {}
  ): Promise<RunStartResponse> {
    assertRunTarget(target);
    assertInputNotOptionsBag(input);

    const { pathTarget, version } = pathTargetFromRunTarget(target);
    const query = runQuery({
      waitForCompletion: options.waitForCompletion,
      version,
    });

    if (hasFileInput(input)) {
      const { formData } = await buildRunMultipart({
        target: pathTarget,
        input,
        overrides: options.overrides,
        metadata: options.metadata,
      });
      return this._request<RunStartResponse>(
        () =>
          this.client.post({
            url: '/api/v1/runs',
            query,
            body: formData,
            bodySerializer: null,
            headers: { 'Content-Type': null },
            signal: options.signal,
          }) as Promise<OperationResult<RunStartResponse>>
      );
    }

    const body = buildRunJsonBody(pathTarget, input, options.overrides, options.metadata);
    return this._request<RunStartResponse>(
      () =>
        this.client.post({
          url: '/api/v1/runs',
          query,
          body,
          signal: options.signal,
        }) as Promise<OperationResult<RunStartResponse>>
    );
  }

  async rerun(runId: string, options: RerunOptions = {}): Promise<RunStartResponse> {
    const query: { version?: string; wait_for_completion?: number } = {};
    if (options.version && options.version !== 'latest') {
      query.version = options.version;
    }
    if (options.waitForCompletion !== undefined) {
      query.wait_for_completion = options.waitForCompletion;
    }

    return this._request<RunStartResponse>(
      () =>
        this.client.post({
          url: '/api/v1/runs/{id}/rerun',
          path: { id: runId },
          query: Object.keys(query).length > 0 ? query : undefined,
          signal: options.signal,
        }) as Promise<OperationResult<RunStartResponse>>
    );
  }

  /**
   * Run an operation with automatic retries on 5xx / 429 / network errors,
   * and centralized error mapping into typed `EigenpalError` subclasses.
   *
   * Resources call this via the bound `_request` they receive at construction.
   * The retry budget is `maxRetries`; backoff is exponential (250ms × 2^attempt)
   * unless the response carries a `Retry-After` header.
   */
  private async _request<T>(call: () => Promise<OperationResult<T>>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await call();
        const response = result.response;
        const status = response?.status ?? 0;
        // Guard against misconfigured `baseUrl` pointed at an HTML host
        // (e.g. `https://eigenpal.com` instead of `https://studio.eigenpal.com`).
        // Fires for both 2xx and non-2xx so a 4xx with HTML surfaces a typed
        // baseUrl-pointing error instead of a misleading NotFoundError or a
        // downstream JSON-parse crash. 0.4.10 shipped with this footgun.
        //
        // Don't run on retriable statuses — a 503 maintenance page from a
        // CDN is transient and should consume retry budget, not throw on
        // attempt zero. Only fire when we're about to surface the response
        // as a final result or final error.
        const willRetry = isRetriableStatus(status) && attempt < this.maxRetries;
        if (response && !willRetry) assertJsonResponse(response);
        if (response && response.ok && result.data !== undefined) {
          return result.data;
        }
        // Non-2xx (or response missing — treat as opaque failure).
        if (willRetry) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        const envelope = asEnvelope(result.error);
        const retryAfter = parseRetryAfter(response?.headers.get('retry-after') ?? null);
        throw errorFromResponse(status, envelope, retryAfter);
      } catch (err) {
        // Re-throw mapped EigenpalError subclasses as-is.
        if (err instanceof EigenpalError) throw err;
        // Network/abort error — retry if budget allows. AbortSignal aborts
        // surface as DOMException — we treat them as terminal (don't retry).
        if (isAbortError(err)) throw err;
        if (attempt < this.maxRetries) {
          await sleep(backoff(attempt));
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Add a request-level default timeout. The hey-api client honors any
   * `signal` the caller passes; we only attach a fresh AbortController when
   * none is provided (so per-call signals always win).
   */
  private installTimeoutInterceptor(): void {
    const timeoutMs = this.timeoutMs;
    if (timeoutMs <= 0) return;

    this.client.interceptors.request.use(async (req) => {
      if (req.signal) return req;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(new EigenpalTimeoutError()), timeoutMs);
      // unref keeps the timer from holding the Node.js event loop open after
      // the request resolves. Browsers don't have unref — guard with `?.`.
      timer.unref?.();
      return new Request(req, { signal: ctrl.signal });
    });
  }
}

function pathTargetFromRunTarget(target: RunTarget): { pathTarget: string; version?: string } {
  if (typeof target === 'string') {
    const [pathTarget, version, extra] = target.split('@');
    if (!pathTarget || version === '' || extra !== undefined) {
      throw new EigenpalError('Run target strings must be <target> or <target>@<version>.', {
        status: 0,
      });
    }
    return { pathTarget, version: version && version !== 'latest' ? version : undefined };
  }
  const idOrSlug = target.slug ?? target.id;
  if (!idOrSlug) {
    throw new EigenpalError('Run target objects require `slug` or `id`.', { status: 0 });
  }
  const name =
    target.type === 'agent'
      ? agentPathTarget(idOrSlug)
      : `workflows.${idOrSlug.split('/').join('.')}`;
  return {
    pathTarget: name,
    version: target.version && target.version !== 'latest' ? target.version : undefined,
  };
}

function agentPathTarget(idOrSlug: string): string {
  if (!idOrSlug.includes('.')) return `agents.${idOrSlug.split('/').join('.')}`;
  if (!idOrSlug.startsWith('agents.')) {
    throw new EigenpalError(`Agent target must be rooted at "agents.", got "${idOrSlug}".`, {
      status: 0,
    });
  }
  return idOrSlug;
}

function runQuery(options: {
  waitForCompletion?: number;
  version?: string;
}): { wait_for_completion?: number; version?: string } | undefined {
  const query: { wait_for_completion?: number; version?: string } = {};
  if (options.waitForCompletion !== undefined)
    query.wait_for_completion = options.waitForCompletion;
  if (options.version) query.version = options.version;
  return Object.keys(query).length > 0 ? query : undefined;
}

function assertJsonResponse(response: Response): void {
  // 204 No Content has no body — accept silently.
  if (response.status === 204) return;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  // Match `application/json`, `application/problem+json`, etc. Empty
  // Content-Type is tolerated since some proxies strip it on small bodies.
  if (
    contentType === '' ||
    contentType.includes('json') ||
    contentType.includes('octet-stream') ||
    contentType.includes('zip')
  )
    return;
  throw new EigenpalError(
    `Expected a JSON response from the API but got Content-Type "${contentType}". ` +
      `This usually means \`baseUrl\` points at a non-API host (e.g. the marketing site or ` +
      `a misconfigured proxy). Set \`baseUrl\` to your EigenPal instance root, ` +
      `e.g. "https://studio.eigenpal.com".`,
    { status: response.status }
  );
}

function assertRunTarget(target: RunTarget): void {
  if (typeof target === 'object' && target !== null && 'target' in target) {
    throw new EigenpalError(
      'Pass the run target as the first argument to client.run(target, input?, options?). ' +
        'Do not wrap it in { target }.',
      { status: 0 }
    );
  }
}

function assertInputNotOptionsBag(input: RunInput | undefined): void {
  if (!input || typeof input !== 'object') return;
  if (
    'waitForCompletion' in input ||
    'overrides' in input ||
    'metadata' in input ||
    'signal' in input
  ) {
    throw new EigenpalError(
      'Pass workflow/agent input as the second argument and { waitForCompletion, overrides, metadata, signal } as the third.',
      { status: 0 }
    );
  }
}

function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function retryDelay(response: Response | undefined, attempt: number): number {
  const retryAfterSec = parseRetryAfter(response?.headers.get('retry-after') ?? null);
  return retryAfterSec !== undefined ? retryAfterSec * 1000 : backoff(attempt);
}

function backoff(attempt: number): number {
  return 250 * 2 ** attempt; // 250, 500, 1000, 2000ms
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  if (err instanceof EigenpalTimeoutError) return true;
  if (typeof err === 'object' && err !== null && 'name' in err) {
    return (err as { name: string }).name === 'AbortError';
  }
  return false;
}

function asEnvelope(error: unknown): ApiErrorEnvelope | undefined {
  if (error && typeof error === 'object' && Array.isArray((error as { issues?: unknown }).issues)) {
    return error as ApiErrorEnvelope;
  }
  return undefined;
}

/**
 * Read a single env var as a fallback for an explicit constructor option.
 *
 * The repo's `no-process-env` rule pushes other packages toward
 * `@eigenpal/env`, but this is a published SDK — it can't pull internal
 * env infrastructure. The disables below are scoped to this one helper.
 */
function readEnv(name: string): string | undefined {
  // eslint-disable-next-line no-process-env
  if (typeof process !== 'undefined' && process.env) {
    // eslint-disable-next-line no-process-env
    const v = process.env[name];
    return v && v.length > 0 ? v : undefined;
  }
  return undefined;
}
