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
 * const { executionId } = await client.workflows.run('wf_abc', { input: { ... } });
 *
 * // Sync (server holds the connection up to 60s).
 * const result = await client.workflows.run('wf_abc', { input: { ... } }, {
 *   waitForCompletion: 60,
 * });
 *
 * // Client-side poll (up to 5min by default).
 * const final = await client.workflows.executions.runAndWait('wf_abc', { input: { ... } });
 * ```
 */
export { EigenpalClient, type EigenpalOptions } from './client';

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
export type { ListAgentsOptions, RunAgentOptions } from './resources/agents';
export type { ListRunsOptions } from './resources/runs';
export type { SourceRawOptions, SourceReleasesOptions } from './resources/source';
export type {
  ListVersionsOptions,
  ListWorkflowsOptions,
  RunWorkflowOptions,
  WorkflowInput,
} from './resources/workflows';
// Note: FileReference (by fileId) is intentionally NOT exported. From the
// SDK perspective you always upload a file; fileId is an internal wire id
// the server creates after upload — not something users construct.

export type { RunAndWaitOptions } from './resources/executions';

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
  RunAgentResponse,
  RunSummary,
  RunWorkflowBody,
  RunWorkflowResponse,
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
  RunsResumeResponse,
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
