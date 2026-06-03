import type { OperationResult } from '../client';
import { EigenpalError } from '../errors';
import type { Client } from '../generated/client';
import {
  agentsCreate,
  agentsFilesListOrGet,
  agentsFilesPut,
  agentsFilesUploadBatch,
  agentsGet,
  agentsList,
  agentsRun,
  agentsRunsCancel,
  agentsRunsExpectedCreate,
  agentsRunsExpectedDelete,
  agentsRunsExpectedDownload,
  agentsRunsExpectedList,
  agentsRunsExpectedRename,
  agentsRunsFeedbackDelete,
  agentsRunsFeedbackGet,
  agentsRunsFeedbackUpdate,
  agentsRunsGet,
  agentsRunsList,
  agentsRunsRerun,
  agentsTriggersEmailCreateAlias,
  agentsTriggersEmailDeleteAlias,
  agentsTriggersEmailGet,
  agentsTriggersEmailList,
  agentsTriggersEmailUpdate,
  agentsTriggersEmailUpdateAlias,
  agentsUpdate,
  agentsVersionsList,
} from '../generated/sdk.gen';
import type {
  AgentExecutionExpectedArtifacts,
  AgentExecutionFeedbackDetail,
  AgentRunResponse,
  AgentsTriggersEmailCreateAliasData,
  AgentsTriggersEmailCreateAliasResponse,
  AgentsTriggersEmailDeleteAliasResponse,
  AgentsTriggersEmailGetResponse,
  AgentsTriggersEmailListResponse,
  AgentsTriggersEmailUpdateAliasData,
  AgentsTriggersEmailUpdateAliasResponse,
  AgentsTriggersEmailUpdateData,
  AgentsTriggersEmailUpdateResponse,
  CancelAgentExecutionResponse,
  CopyAgentExecutionOutputToExpectedBody,
  CreateAgentBody,
  CreateAgentResponse,
  GetAgentResponse,
  ListAgentRunsResponse,
  ListAgentVersionsResponse,
  ListAgentsResponse,
  PatchAgentBody,
  PatchAgentResponse,
  RenameExpectedFileBody,
  RerunAgentRunResponse,
  RunAgentResponse,
  UpdateAgentExecutionFeedbackBody,
} from '../generated/types.gen';
import { buildAgentMultipart, hasFileInput } from '../lib/files';
import type { WorkflowInput } from './workflows';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;

export interface ListAgentsOptions {
  search?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface RunAgentOptions {
  waitForCompletion?: number;
  sourceRef?: string;
  signal?: AbortSignal;
}

export interface ListAgentRunsOptions {
  status?: string;
  batchId?: string;
  exampleId?: string;
  exampleIdContains?: string;
  createdAfter?: string;
  createdBefore?: string;
  completedAfter?: string;
  completedBefore?: string;
  feedbackStatus?: 'open' | 'resolved' | 'ignored';
  feedbackRating?: 'pass' | 'fail' | 'partial' | 'none';
  hasFeedback?: boolean;
  noFeedback?: boolean;
  hasExpected?: boolean;
  hasExpectedJson?: boolean;
  hasExpectedFiles?: boolean;
  feedbackBodyContains?: string;
  feedbackCreatedAfter?: string;
  feedbackCreatedBefore?: string;
  feedbackUpdatedAfter?: string;
  feedbackUpdatedBefore?: string;
  feedbackResolvedAfter?: string;
  feedbackResolvedBefore?: string;
  promotedToExample?: boolean;
  promotedExampleName?: string;
  sinceLastResolved?: boolean;
  include?: string;
  sort?: 'createdAt' | 'completedAt' | 'status' | 'exampleId';
  order?: 'asc' | 'desc';
  scanLimit?: number;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export type AgentExecutionFileKind = 'input' | 'output' | 'issues' | 'trace' | 'lockfile';

export class AgentEmailTriggersResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(options: { signal?: AbortSignal } = {}): Promise<AgentsTriggersEmailListResponse> {
    return this.dispatch(() =>
      agentsTriggersEmailList({ client: this.client, signal: options.signal })
    );
  }

  async get(
    agentId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentsTriggersEmailGetResponse> {
    return this.dispatch(() =>
      agentsTriggersEmailGet({
        client: this.client,
        path: { agentId },
        signal: options.signal,
      })
    );
  }

  async update(
    agentId: string,
    body: AgentsTriggersEmailUpdateData['body'],
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentsTriggersEmailUpdateResponse> {
    return this.dispatch(() =>
      agentsTriggersEmailUpdate({
        client: this.client,
        path: { agentId },
        body,
        signal: options.signal,
      })
    );
  }

  async createAlias(
    agentId: string,
    body: AgentsTriggersEmailCreateAliasData['body'],
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentsTriggersEmailCreateAliasResponse> {
    return this.dispatch(() =>
      agentsTriggersEmailCreateAlias({
        client: this.client,
        path: { agentId },
        body,
        signal: options.signal,
      })
    );
  }

  async updateAlias(
    agentId: string,
    emailId: string,
    body: AgentsTriggersEmailUpdateAliasData['body'],
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentsTriggersEmailUpdateAliasResponse> {
    return this.dispatch(() =>
      agentsTriggersEmailUpdateAlias({
        client: this.client,
        path: { agentId, emailId },
        body,
        signal: options.signal,
      })
    );
  }

  async deleteAlias(
    agentId: string,
    emailId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentsTriggersEmailDeleteAliasResponse> {
    return this.dispatch(() =>
      agentsTriggersEmailDeleteAlias({
        client: this.client,
        path: { agentId, emailId },
        signal: options.signal,
      })
    );
  }
}

export class AgentRunsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(agentId: string, options: ListAgentRunsOptions = {}): Promise<ListAgentRunsResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      agentsRunsList({ client: this.client, path: { agentId }, query, signal })
    );
  }

  async get(
    runId: string,
    options: { include?: string; signal?: AbortSignal } = {}
  ): Promise<AgentRunResponse> {
    const { signal, include } = options;
    return this.dispatch(() =>
      agentsRunsGet({
        client: this.client,
        path: { runId },
        query: include ? { include } : {},
        signal,
      })
    );
  }

  async cancel(
    runId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<CancelAgentExecutionResponse> {
    return this.dispatch(() =>
      agentsRunsCancel({
        client: this.client,
        path: { runId },
        signal: options.signal,
      })
    );
  }

  async rerun(
    runId: string,
    options: { sourceRef?: string; signal?: AbortSignal } = {}
  ): Promise<RerunAgentRunResponse> {
    return this.dispatch(() =>
      agentsRunsRerun({
        client: this.client,
        path: { runId },
        body: {
          ...(options.sourceRef !== undefined ? { sourceRef: options.sourceRef } : {}),
        },
        signal: options.signal,
      })
    );
  }

  async getFeedback(
    runId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentExecutionFeedbackDetail> {
    return this.dispatch(() =>
      agentsRunsFeedbackGet({
        client: this.client,
        path: { runId },
        signal: options.signal,
      })
    );
  }

  async updateFeedback(
    runId: string,
    body: UpdateAgentExecutionFeedbackBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentExecutionFeedbackDetail> {
    return this.dispatch(() =>
      agentsRunsFeedbackUpdate({
        client: this.client,
        path: { runId },
        body,
        signal: options.signal,
      })
    );
  }

  async clearFeedback(
    runId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentExecutionFeedbackDetail> {
    return this.dispatch(() =>
      agentsRunsFeedbackDelete({
        client: this.client,
        path: { runId },
        signal: options.signal,
      })
    );
  }

  async listExpected(
    runId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentExecutionExpectedArtifacts> {
    return this.dispatch(() =>
      agentsRunsExpectedList({
        client: this.client,
        path: { runId },
        signal: options.signal,
      })
    );
  }

  async copyOutputToExpected(
    runId: string,
    body: CopyAgentExecutionOutputToExpectedBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<{ name: string }> {
    return this.dispatch(() =>
      agentsRunsExpectedCreate({
        client: this.client,
        path: { runId },
        body,
        signal: options.signal,
      })
    );
  }

  async renameExpected(
    runId: string,
    filename: string,
    body: RenameExpectedFileBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<{ name: string }> {
    return this.dispatch(() =>
      agentsRunsExpectedRename({
        client: this.client,
        path: { runId, filename },
        body,
        signal: options.signal,
      })
    );
  }

  async deleteExpected(
    runId: string,
    filename: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<void> {
    await this.dispatch(() =>
      agentsRunsExpectedDelete({
        client: this.client,
        path: { runId, filename },
        signal: options.signal,
      })
    );
  }

  async uploadExpected(
    runId: string,
    file: Blob,
    options: { name?: string; signal?: AbortSignal } = {}
  ): Promise<{ name: string }> {
    const formData = new FormData();
    formData.set('file', file);
    if (options.name) formData.set('name', options.name);
    return this.dispatch(
      () =>
        this.client.post({
          url: '/api/v1/agents/runs/{runId}/expected',
          path: { runId },
          body: formData,
          bodySerializer: null,
          headers: { 'Content-Type': null },
          signal: options.signal,
        }) as Promise<OperationResult<{ name: string }>>
    );
  }

  async downloadExpected(
    runId: string,
    filename: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<Blob> {
    return this.downloadBlob(
      () =>
        agentsRunsExpectedDownload({
          client: this.client,
          path: { runId, filename },
          parseAs: 'blob',
          signal: options.signal,
        }) as Promise<OperationResult<Blob>>
    );
  }

  async downloadFile(
    runId: string,
    artifactPathOrKind: string,
    filenameOrOptions?: string | { signal?: AbortSignal },
    options: { signal?: AbortSignal } = {}
  ): Promise<Blob> {
    const artifactPath =
      typeof filenameOrOptions === 'string'
        ? artifactPathForKind(artifactPathOrKind as AgentExecutionFileKind, filenameOrOptions)
        : artifactPathOrKind;
    const requestOptions =
      typeof filenameOrOptions === 'string' ? options : (filenameOrOptions ?? {});
    return this.downloadBlob(
      () =>
        this.client.get({
          url: `/api/v1/agents/runs/${encodeURIComponent(runId)}/files/${encodeArtifactPath(
            artifactPath
          )}`,
          parseAs: 'blob',
          signal: requestOptions.signal,
        }) as Promise<OperationResult<Blob>>
    );
  }

  private async downloadBlob(call: () => Promise<OperationResult<Blob>>): Promise<Blob> {
    const result = await call();
    if (result.response?.ok && result.data instanceof Blob) {
      return result.data;
    }
    throw new EigenpalError('Failed to download agent execution artifact.', {
      status: result.response?.status ?? 0,
    });
  }
}

function artifactPathForKind(kind: AgentExecutionFileKind, filename: string): string {
  if (kind === 'issues' || kind === 'trace' || kind === 'lockfile') return filename;
  return `${kind}/${filename}`;
}

function encodeArtifactPath(artifactPath: string): string {
  return artifactPath.split('/').map(encodeURIComponent).join('/');
}

export class AgentsResource {
  public readonly runs: AgentRunsResource;
  public readonly emailTriggers: AgentEmailTriggersResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.runs = new AgentRunsResource(client, dispatch);
    this.emailTriggers = new AgentEmailTriggersResource(client, dispatch);
  }

  async list(options: ListAgentsOptions = {}): Promise<ListAgentsResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() => agentsList({ client: this.client, query, signal }));
  }

  async get(agentId: string, options: { signal?: AbortSignal } = {}): Promise<GetAgentResponse> {
    return this.dispatch(() =>
      agentsGet({ client: this.client, path: { agentId }, signal: options.signal })
    );
  }

  async listFiles(
    agentId: string,
    options: { path?: string; prefix?: string; signal?: AbortSignal } = {}
  ): Promise<unknown> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      agentsFilesListOrGet({ client: this.client, path: { agentId }, query, signal })
    );
  }

  async putFile(
    agentId: string,
    path: string,
    body: Record<string, unknown>,
    options: { signal?: AbortSignal } = {}
  ): Promise<unknown> {
    return this.dispatch(() =>
      agentsFilesPut({
        client: this.client,
        path: { agentId },
        query: { path },
        body,
        signal: options.signal,
      })
    );
  }

  async uploadFiles(
    agentId: string,
    body: Record<string, unknown>,
    options: { signal?: AbortSignal } = {}
  ): Promise<unknown> {
    return this.dispatch(() =>
      agentsFilesUploadBatch({
        client: this.client,
        path: { agentId },
        body,
        signal: options.signal,
      })
    );
  }

  async versions(
    agentId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<ListAgentVersionsResponse> {
    return this.dispatch(() =>
      agentsVersionsList({ client: this.client, path: { agentId }, signal: options.signal })
    );
  }

  async create(
    body: CreateAgentBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<CreateAgentResponse> {
    return this.dispatch(() => agentsCreate({ client: this.client, body, signal: options.signal }));
  }

  async update(
    agentId: string,
    body: PatchAgentBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<PatchAgentResponse> {
    return this.dispatch(() =>
      agentsUpdate({ client: this.client, path: { agentId }, body, signal: options.signal })
    );
  }

  async run(
    agentId: string,
    input?: WorkflowInput,
    options: RunAgentOptions = {}
  ): Promise<RunAgentResponse> {
    const query = {
      ...(options.waitForCompletion !== undefined
        ? { wait_for_completion: options.waitForCompletion }
        : {}),
      ...(options.sourceRef !== undefined ? { sourceRef: options.sourceRef } : {}),
    };

    if (hasFileInput(input)) {
      const { formData } = await buildAgentMultipart(input);
      return this.dispatch<RunAgentResponse>(
        () =>
          this.client.post({
            url: '/api/v1/agents/{agentId}/run',
            path: { agentId },
            query,
            body: formData,
            bodySerializer: null,
            headers: { 'Content-Type': null },
            signal: options.signal,
          }) as Promise<OperationResult<RunAgentResponse>>
      );
    }

    return this.dispatch(() =>
      agentsRun({
        client: this.client,
        path: { agentId },
        query,
        body: {
          ...(input !== undefined ? { input } : {}),
          ...(options.sourceRef !== undefined ? { sourceRef: options.sourceRef } : {}),
        },
        signal: options.signal,
      })
    );
  }
}
