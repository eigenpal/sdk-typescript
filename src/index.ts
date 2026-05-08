/**
 * Official TypeScript SDK for the Eigenpal API.
 *
 * @example
 * ```ts
 * import { Eigenpal } from '@eigenpal/sdk';
 *
 * const client = new Eigenpal({ apiKey: process.env.EIGENPAL_API_KEY! });
 *
 * // Async — enqueue and poll later.
 * const { executionId } = await client.workflows.run('wf_abc', { input: { ... } });
 *
 * // Sync (server holds the connection up to 60s).
 * const result = await client.workflows.run('wf_abc', { input: { ... } }, {
 *   waitForCompletion: 60,
 * });
 *
 * // Client-side poll (up to 5min by default).
 * const final = await client.executions.runAndWait('wf_abc', { input: { ... } });
 * ```
 */
export { Eigenpal, type EigenpalOptions } from './client';

export {
  EigenpalAuthError,
  EigenpalError,
  EigenpalForbiddenError,
  EigenpalNotFoundError,
  EigenpalRateLimitError,
  EigenpalServerError,
  EigenpalTimeoutError,
  EigenpalValidationError,
} from './errors';

export type { FileDescriptor, FileInput } from './lib/files';
export type {
  ListVersionsOptions,
  ListWorkflowsOptions,
  RunWorkflowOptions,
  WorkflowInput,
} from './resources/workflows';
// Note: FileReference (by fileId) is intentionally NOT exported. From the
// SDK perspective you always upload a file; fileId is an internal wire id
// the server creates after upload — not something users construct.

export type { ListExecutionsOptions, RunAndWaitOptions } from './resources/executions';

// Re-export the canonical generated types so users can type their own
// callbacks and helpers without reaching into `./generated`.
export type {
  ApiErrorEnvelope,
  ApiErrorIssue,
  CancelExecutionResponse,
  ExecutionStatus,
  ExecutionStatusResponse,
  ExecutionSummary,
  ListExecutionsResponse,
  ListVersionsResponse,
  ListWorkflowsResponse,
  RunWorkflowBody,
  RunWorkflowResponse,
  WorkflowSummary,
  WorkflowVersion,
} from './generated/types.gen';
