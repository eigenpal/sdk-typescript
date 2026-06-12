/**
 * Official TypeScript SDK for the EigenPal API.
 *
 * @example
 * ```ts
 * import { EigenpalClient } from '@eigenpal/sdk';
 *
 * const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY! });
 *
 * // Async — enqueue and poll later.
 * const { runId } = await client.run('workflows.extract-invoice', {
 *   input: { ... },
 * });
 *
 * // Sync (server holds the connection up to 60s).
 * const result = await client.run('workflows.extract-invoice', {
 *   input: { ... },
 *   waitForCompletion: 60,
 * });
 *
 * // Client-side poll (up to 5min by default).
 * const final = await client.workflows.executions.runAndWait('wf_abc', { input: { ... } });
 * ```
 */
export {
  EigenpalClient,
  type EigenpalOptions,
  type RerunOptions,
  type RunInput,
  type RunOptions,
  type RunStartResponse,
  type RunTarget,
} from './client';

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

export { toFile } from './lib/files';
export type { FileDescriptor, FileInput, NodeReadableStream } from './lib/files';
export type { ListAgentsOptions } from './resources/agents';
export type { ListRunsOptions } from './resources/runs';
export type { SourceRawOptions, SourceReleasesOptions } from './resources/source';
export type {
  ListVersionsOptions,
  ListWorkflowsOptions,
  WorkflowInput,
} from './resources/workflows';
// Note: FileReference (by fileId) is intentionally NOT exported. From the
// SDK perspective you always upload a file; fileId is an internal wire id
// the server creates after upload — not something users construct.

export type { RunAndWaitOptions, WorkflowRunAndWaitResponse } from './resources/executions';

// Re-export the canonical generated types so users can type their own
// callbacks and helpers without reaching into `./generated`.
export type {
  AgentSummary,
  AgentsTriggersEmailCreateAliasData,
  AgentsTriggersEmailCreateAliasResponse,
  AgentsTriggersEmailDeleteAliasResponse,
  AgentsTriggersEmailGetResponse,
  AgentsTriggersEmailListResponse,
  AgentsTriggersEmailUpdateAliasData,
  AgentsTriggersEmailUpdateAliasResponse,
  AgentsTriggersEmailUpdateData,
  AgentsTriggersEmailUpdateResponse,
  ApiErrorEnvelope,
  ApiErrorIssue,
  AutomationSyncResponse,
  ExecutionStatus,
  GetAgentResponse,
  ListAgentsResponse,
  ListVersionsResponse,
  ListWorkflowsResponse,
  RawSourceResponse,
  RunSummary,
  RunTargetInputBody,
  RunsCancelResponse,
  RunsExpectedCreateResponse,
  RunsExpectedFileDeleteResponse,
  RunsExpectedFileUpdateResponse,
  RunsExpectedGetResponse,
  RunsFeedbackClearResponse,
  RunsFeedbackUpdateResponse,
  RunsGetResponse,
  RunsListResponse,
  RunsRerunResponse,
  SourceLockfileResponse,
  SourceReleasesResponse,
  SourceRepositoryResponse,
  SourceSecretsDecryptBody,
  SourceSecretsDecryptResponse,
  SourceSecretsEncryptBody,
  SourceSecretsEncryptResponse,
  WorkflowDetail,
  WorkflowSummary,
  WorkflowVersion,
} from './generated/types.gen';
