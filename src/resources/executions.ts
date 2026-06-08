import type { OperationResult } from '../client';
import { EigenpalTimeoutError } from '../errors';
import type { Client } from '../generated/client';
import { runsGet, workflowsRun } from '../generated/sdk.gen';
import type { ExecutionStatus, RunsGetResponse, RunWorkflowResponse } from '../generated/types.gen';
import { buildMultipart, hasFileInput } from '../lib/files';
import type { WorkflowInput } from './workflows';

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
 * Workflow execution helper namespace. Retrieval and mutation of existing runs
 * lives on `client.runs`; this namespace only keeps `runAndWait` because it
 * triggers a workflow before polling.
 */
export class WorkflowExecutionsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

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
    let runResult: RunWorkflowResponse;
    if (hasFileInput(input)) {
      // Build the multipart body once, up front — `dispatch` may retry the
      // POST, and a drained stream cannot be replayed.
      const { formData } = await buildMultipart({ input, overrides: options.overrides });
      runResult = await this.dispatch<RunWorkflowResponse>(
        () =>
          this.client.post({
            url: '/api/v1/workflows/{id}/run',
            path: { id: workflowId },
            query: triggerQuery,
            body: formData,
            bodySerializer: null,
            headers: { 'Content-Type': null },
            signal: options.signal,
          }) as Promise<OperationResult<RunWorkflowResponse>>
      );
    } else {
      runResult = await this.dispatch<RunWorkflowResponse>(() =>
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
    }

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

      const response = await this.dispatch<RunsGetResponse>(
        () =>
          runsGet({
            client: this.client,
            path: { id: executionId },
            query: { include: 'detail' },
            signal: options.signal,
          }) as Promise<OperationResult<RunsGetResponse>>
      );
      const status = response.run as {
        status?: ExecutionStatus | null;
        result?: unknown;
        error?: string | null;
      };

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
