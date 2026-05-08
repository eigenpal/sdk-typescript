import type { OperationResult } from '../client';
import { EigenpalTimeoutError } from '../errors';
import type { Client } from '../generated/client';
import {
  executionsCancel,
  executionsGet,
  executionsList,
  workflowsRun,
} from '../generated/sdk.gen';
import type {
  CancelExecutionResponse,
  ExecutionStatus,
  ExecutionStatusResponse,
  ListExecutionsResponse,
  RunWorkflowResponse,
} from '../generated/types.gen';
import { buildMultipart, hasFileInput } from '../lib/files';
import type { WorkflowInput } from './workflows';

export interface ListExecutionsOptions {
  workflowId?: string;
  /** Comma-separated list of execution statuses. */
  status?: string;
  /** ISO timestamp or relative expression like `"now()-7d"`. */
  fromDate?: string;
  toDate?: string;
  exampleId?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface RunAndWaitOptions {
  /** Workflow version. Default: `"latest"`. */
  version?: string;
  /** Per-step output overrides for replay. */
  overrides?: { steps?: Record<string, Record<string, unknown>> };
  /** Polling interval in milliseconds. Default: 2_000. */
  pollIntervalMs?: number;
  /**
   * Total client-side timeout in milliseconds. Default: 5 minutes. Throws
   * `EigenpalTimeoutError` if the run hasn't reached a terminal state by then.
   */
  timeoutMs?: number;
  /** AbortSignal to cancel the entire poll loop. */
  signal?: AbortSignal;
}

const TERMINAL_STATUSES = new Set<ExecutionStatus>([
  'completed',
  'failed',
  'cancelled',
  'rejected',
]);

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_RUN_AND_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;

/**
 * Execution resource — read execution status, list executions, cancel
 * in-flight runs, and the convenience `runAndWait` helper that wraps a
 * workflow trigger + client-side poll loop. Reached via `client.executions`.
 */
export class ExecutionsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  /** Get execution status. Pass `includeSteps` for the full per-step payload. */
  async get(
    executionId: string,
    options: { includeSteps?: boolean; signal?: AbortSignal } = {}
  ): Promise<ExecutionStatusResponse> {
    return this.dispatch<ExecutionStatusResponse>(
      () =>
        executionsGet({
          client: this.client,
          path: { executionId },
          query: options.includeSteps ? { includeSteps: 'true' } : {},
          signal: options.signal,
        }) as Promise<OperationResult<ExecutionStatusResponse>>
    );
  }

  /** List executions, paginated. */
  async list(options: ListExecutionsOptions = {}): Promise<ListExecutionsResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() => executionsList({ client: this.client, query, signal }));
  }

  /** Cancel an execution. Idempotent. */
  async cancel(
    executionId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<CancelExecutionResponse> {
    return this.dispatch(() =>
      executionsCancel({
        client: this.client,
        path: { executionId },
        signal: options.signal,
      })
    );
  }

  /**
   * Trigger a workflow and poll for completion client-side.
   *
   * Unlike `workflows.run({ waitForCompletion: 60 })`, this helper polls
   * indefinitely (up to `timeoutMs`, default 5 min) so it works for runs
   * that exceed the server-side 60s sync window. Returns the final
   * response with `status`/`result`/`error` populated.
   */
  async runAndWait(
    workflowId: string,
    input?: WorkflowInput,
    options: RunAndWaitOptions = {}
  ): Promise<RunWorkflowResponse> {
    const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_RUN_AND_WAIT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;

    // Trigger async — we don't ask the server to wait, since we're polling.
    const triggerQuery = options.version ? { version: options.version } : {};
    const runResult = hasFileInput(input)
      ? await this.dispatch<RunWorkflowResponse>(() => {
          const { formData } = buildMultipart({ input, overrides: options.overrides });
          return this.client.post({
            url: '/v1/workflows/{id}/run',
            path: { id: workflowId },
            query: triggerQuery,
            body: formData,
            bodySerializer: null,
            headers: { 'Content-Type': null },
            signal: options.signal,
          }) as Promise<OperationResult<RunWorkflowResponse>>;
        })
      : await this.dispatch<RunWorkflowResponse>(() =>
          workflowsRun({
            client: this.client,
            path: { id: workflowId },
            query: triggerQuery,
            body: {
              ...(input !== undefined ? { input } : {}),
              ...(options.overrides ? { overrides: options.overrides } : {}),
            },
            signal: options.signal,
          })
        );

    const { executionId } = runResult;

    while (true) {
      if (options.signal?.aborted) {
        throw new EigenpalTimeoutError('runAndWait aborted');
      }
      if (Date.now() >= deadline) {
        throw new EigenpalTimeoutError(
          `runAndWait timed out after ${timeoutMs}ms (executionId=${executionId})`
        );
      }

      const status = await this.get(executionId, { signal: options.signal });

      if (status.status && TERMINAL_STATUSES.has(status.status)) {
        return {
          executionId,
          status: status.status,
          ...(status.result != null ? { result: status.result } : {}),
          ...(status.error != null ? { error: status.error } : {}),
        };
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}
