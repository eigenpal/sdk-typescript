import type { OperationResult } from '../client';
import { EigenpalTimeoutError } from '../errors';
import type { Client } from '../generated/client';
import { runsGet } from '../generated/sdk.gen';
import type { ExecutionStatus, RunsGetResponse } from '../generated/types.gen';
import { buildRunJsonBody, buildRunMultipart, hasFileInput } from '../lib/files';
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

export type WorkflowRunAndWaitResponse = {
  runId: string;
  status?: ExecutionStatus;
  output?: unknown;
  error?: string;
};

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
   * Unlike `client.run({ waitForCompletion: 60 })`, this helper polls
   * indefinitely (up to `timeoutMs`, default 5 min) so it works for runs
   * that exceed the server-side 60s sync window. Returns the final
   * response with `status`/`output`/`error` populated.
   */
  async runAndWait(
    workflowId: string,
    input?: WorkflowInput,
    options: RunAndWaitOptions = {}
  ): Promise<WorkflowRunAndWaitResponse> {
    const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_RUN_AND_WAIT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;

    const target = `workflows.${workflowId}`;
    const runUrl = `/api/v1/run/${encodeURIComponent(target)}`;
    const runQuery =
      options.version && options.version !== 'latest' ? { version: options.version } : undefined;
    let runResult: { runId: string };
    if (hasFileInput(input)) {
      // Build the multipart body once, up front — `dispatch` may retry the
      // POST, and a drained stream cannot be replayed.
      const { formData } = await buildRunMultipart({ input, overrides: options.overrides });
      runResult = await this.dispatch<{ runId: string }>(
        () =>
          this.client.post({
            url: runUrl,
            query: runQuery,
            body: formData,
            bodySerializer: null,
            headers: { 'Content-Type': null },
            signal: options.signal,
          }) as Promise<OperationResult<{ runId: string }>>
      );
    } else {
      const body = buildRunJsonBody(input, options.overrides);
      runResult = await this.dispatch<{ runId: string }>(
        () =>
          this.client.post({
            url: runUrl,
            query: runQuery,
            body,
            signal: options.signal,
          }) as Promise<OperationResult<{ runId: string }>>
      );
    }

    const runId = runResult.runId;

    while (true) {
      if (options.signal?.aborted) {
        throw new EigenpalTimeoutError('runAndWait aborted');
      }
      if (Date.now() >= deadline) {
        throw new EigenpalTimeoutError(
          `runAndWait timed out after ${timeoutMs}ms (runId=${runId})`
        );
      }

      const response = await this.dispatch<RunsGetResponse>(
        () =>
          runsGet({
            client: this.client,
            path: { id: runId },
            query: { include: 'detail' },
            signal: options.signal,
          }) as Promise<OperationResult<RunsGetResponse>>
      );
      const status = response.run as {
        status?: ExecutionStatus | null;
        output?: unknown;
        error?: string | null;
      };

      if (status.status && TERMINAL_STATUSES.has(status.status)) {
        return {
          runId,
          status: status.status,
          ...(status.output != null ? { output: status.output } : {}),
          ...(status.error != null ? { error: status.error } : {}),
        };
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}
