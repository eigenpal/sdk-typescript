import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import {
  workflowsGet,
  workflowsList,
  workflowsRun,
  workflowsVersionsList,
} from '../generated/sdk.gen';
import type {
  ListVersionsResponse,
  ListWorkflowsResponse,
  RunWorkflowResponse,
  WorkflowSummary,
} from '../generated/types.gen';
import { buildMultipart, hasFileInput } from '../lib/files';
import { WorkflowExecutionsResource } from './executions';

/**
 * Workflow inputs keyed by name as declared in the workflow YAML.
 *
 * File values (`File`, `Blob`, or `{ content, filename, mimeType }`) are
 * detected automatically and uploaded as `multipart/form-data` — same as
 * `curl -F`. No base64 round-trip required.
 */
export type WorkflowInput = Record<string, unknown>;

export interface RunWorkflowOptions {
  /** Specific version id, or `"latest"` (default). */
  version?: string;
  /** Hold the connection up to N seconds for completion (max 60). Omit for async. */
  waitForCompletion?: number;
  /** Per-step output overrides for replay. */
  overrides?: { steps?: Record<string, Record<string, unknown>> };
  /** AbortSignal to cancel the request. */
  signal?: AbortSignal;
}

export interface ListWorkflowsOptions {
  /** Substring match against workflow name. */
  search?: string;
  /** Exact-match by workflow name (slug). */
  name?: string;
  kind?: 'workflow' | 'block';
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface ListVersionsOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;

/**
 * Workflow resource — list, get, run, and inspect versions of saved
 * workflows. Reached via `client.workflows`.
 */
export class WorkflowsResource {
  public readonly executions: WorkflowExecutionsResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.executions = new WorkflowExecutionsResource(client, dispatch);
  }

  /**
   * Execute a workflow.
   *
   * @param workflowId — id like `wf_abc123`.
   * @param input — workflow inputs keyed by name. Pass `undefined` for inputs-less workflows.
   * @param options — `version`, `waitForCompletion`, `overrides`.
   *
   * - With no `waitForCompletion`, returns immediately with `{ executionId }`.
   *   Poll via `client.workflows.executions.get(id)` or use
   *   `client.workflows.executions.runAndWait`.
   * - With `waitForCompletion: 60`, the server holds the connection up to 60
   *   seconds. The response also includes `status`, `result`, and `error`
   *   when the run finishes within the window.
   */
  async run(
    workflowId: string,
    input?: WorkflowInput,
    options: RunWorkflowOptions = {}
  ): Promise<RunWorkflowResponse> {
    const query = {
      ...(options.version ? { version: options.version } : {}),
      ...(options.waitForCompletion !== undefined
        ? { wait_for_completion: options.waitForCompletion }
        : {}),
    };

    // File-bearing input → multipart/form-data (no base64 overhead).
    if (hasFileInput(input)) {
      const { formData } = buildMultipart({ input, overrides: options.overrides });
      return this.dispatch<RunWorkflowResponse>(
        () =>
          this.client.post({
            url: '/api/v1/workflows/{id}/run',
            path: { id: workflowId },
            query,
            body: formData,
            // Skip JSON serialization; FormData passes through to fetch which
            // sets the Content-Type header (with boundary) automatically.
            bodySerializer: null,
            // Explicitly null the JSON Content-Type header that the request
            // pipeline would otherwise inherit.
            headers: { 'Content-Type': null },
            signal: options.signal,
          }) as Promise<OperationResult<RunWorkflowResponse>>
      );
    }

    return this.dispatch<RunWorkflowResponse>(() =>
      workflowsRun({
        client: this.client,
        path: { id: workflowId },
        query,
        body: {
          ...(input !== undefined ? { input } : {}),
          ...(options.overrides ? { overrides: options.overrides } : {}),
        },
        signal: options.signal,
      })
    );
  }

  /** List workflows, paginated. */
  async list(options: ListWorkflowsOptions = {}): Promise<ListWorkflowsResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() => workflowsList({ client: this.client, query, signal }));
  }

  /** Get a single workflow by id. */
  async get(workflowId: string, options: { signal?: AbortSignal } = {}): Promise<WorkflowSummary> {
    return this.dispatch(() =>
      workflowsGet({ client: this.client, path: { id: workflowId }, signal: options.signal })
    );
  }

  /** List tagged versions for a workflow, paginated. */
  async versions(
    workflowId: string,
    options: ListVersionsOptions = {}
  ): Promise<ListVersionsResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      workflowsVersionsList({
        client: this.client,
        path: { id: workflowId },
        query,
        signal,
      })
    );
  }
}
