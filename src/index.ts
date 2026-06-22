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
 * const { id } = await client.run('workflows.extract-invoice', { ... });
 *
 * // Sync (server holds the connection up to 60s).
 * const result = await client.run('workflows.extract-invoice', { ... }, { waitForCompletion: 60 });
 *
 * // Inspect or manage runs later.
 * const final = await client.runs.get(id);
 * ```
 */
export {
  EigenpalClient,
  isRunFinished,
  type EigenpalOptions,
  type RerunOptions,
  type RunCallOptions,
  type RunInput,
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
export type { ListRunsOptions, RunExpand, RunExpandSection } from './resources/runs';

// Re-export the canonical generated types so users can type their own
// callbacks and helpers without reaching into `./generated`.
export type {
  ApiErrorEnvelope,
  ApiErrorIssue,
  AuthCheckResponse,
  AutomationDetail,
  AutomationSummary,
  AutomationTriggerState,
  AutomationTriggersResponse,
  AutomationVersion,
  ExecutionStatus,
  File,
  Run,
  RunArtifact,
  RunArtifactsResponse,
  RunEvent,
  RunEventsResponse,
  RunListItem,
  RunStartBody,
  RunStepsResponse,
  RunUsage,
  RunUsageResponse,
  RunsCancelResponse,
  RunsFeedbackClearResponse,
  RunsFeedbackExpectedCreateResponse,
  RunsFeedbackExpectedFileDeleteResponse,
  RunsFeedbackExpectedFileUpdateResponse,
  RunsFeedbackExpectedGetResponse,
  RunsFeedbackGetResponse,
  RunsFeedbackUpdateResponse,
  RunsGetResponse,
  RunsListResponse,
  RunsRerunResponse,
  RunsTraceGetResponse,
} from './generated/types.gen';
