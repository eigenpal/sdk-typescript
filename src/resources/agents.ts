import type { OperationResult } from '../client';
import { EigenpalError } from '../errors';
import type { Client } from '../generated/client';
import {
  agentsCreate,
  agentsExecutionsCancel,
  agentsExecutionsExpectedCreate,
  agentsExecutionsExpectedDelete,
  agentsExecutionsExpectedDownload,
  agentsExecutionsExpectedList,
  agentsExecutionsExpectedRename,
  agentsExecutionsFeedbackDelete,
  agentsExecutionsFeedbackGet,
  agentsExecutionsFeedbackUpdate,
  agentsExecutionsFilesDownload,
  agentsExecutionsGet,
  agentsExecutionsList,
  agentsExecutionsRerun,
  agentsFilesListOrGet,
  agentsFilesPut,
  agentsFilesUploadBatch,
  agentsGet,
  agentsList,
  agentsRun,
  agentsUpdate,
} from '../generated/sdk.gen';
import type {
  AgentExecutionExpectedArtifacts,
  AgentExecutionFeedbackDetail,
  AgentExecutionResponse,
  AgentFileBody,
  AgentFilesBody,
  CopyAgentExecutionOutputToExpectedBody,
  CreateAgentBody,
  CreateAgentResponse,
  GetAgentResponse,
  ListAgentExecutionsResponse,
  ListAgentsResponse,
  PatchAgentBody,
  PatchAgentResponse,
  RenameExpectedFileBody,
  RerunAgentExecutionResponse,
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
  signal?: AbortSignal;
}

export interface ListAgentExecutionsOptions {
  status?: string;
  batchId?: string;
  exampleName?: string;
  exampleNameContains?: string;
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
  sort?: 'createdAt' | 'completedAt' | 'status' | 'exampleName';
  order?: 'asc' | 'desc';
  scanLimit?: number;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export type AgentExecutionFileKind = 'input' | 'output' | 'issues' | 'trace';

export class AgentExecutionsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(
    agentId: string,
    options: ListAgentExecutionsOptions = {}
  ): Promise<ListAgentExecutionsResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      agentsExecutionsList({ client: this.client, path: { agentId }, query, signal })
    );
  }

  async get(
    executionId: string,
    options: { include?: string; signal?: AbortSignal } = {}
  ): Promise<AgentExecutionResponse> {
    const { signal, include } = options;
    return this.dispatch(() =>
      agentsExecutionsGet({
        client: this.client,
        path: { executionId },
        query: include ? { include } : {},
        signal,
      })
    );
  }

  async cancel(
    executionId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentExecutionResponse> {
    return this.dispatch(() =>
      agentsExecutionsCancel({
        client: this.client,
        path: { executionId },
        signal: options.signal,
      })
    );
  }

  async rerun(
    executionId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<RerunAgentExecutionResponse> {
    return this.dispatch(() =>
      agentsExecutionsRerun({
        client: this.client,
        path: { executionId },
        signal: options.signal,
      })
    );
  }

  async getFeedback(
    executionId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentExecutionFeedbackDetail> {
    return this.dispatch(() =>
      agentsExecutionsFeedbackGet({
        client: this.client,
        path: { executionId },
        signal: options.signal,
      })
    );
  }

  async updateFeedback(
    executionId: string,
    body: UpdateAgentExecutionFeedbackBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentExecutionFeedbackDetail> {
    return this.dispatch(() =>
      agentsExecutionsFeedbackUpdate({
        client: this.client,
        path: { executionId },
        body,
        signal: options.signal,
      })
    );
  }

  async clearFeedback(
    executionId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentExecutionFeedbackDetail> {
    return this.dispatch(() =>
      agentsExecutionsFeedbackDelete({
        client: this.client,
        path: { executionId },
        signal: options.signal,
      })
    );
  }

  async listExpected(
    executionId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AgentExecutionExpectedArtifacts> {
    return this.dispatch(() =>
      agentsExecutionsExpectedList({
        client: this.client,
        path: { executionId },
        signal: options.signal,
      })
    );
  }

  async copyOutputToExpected(
    executionId: string,
    body: CopyAgentExecutionOutputToExpectedBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<{ name: string }> {
    return this.dispatch(() =>
      agentsExecutionsExpectedCreate({
        client: this.client,
        path: { executionId },
        body,
        signal: options.signal,
      })
    );
  }

  async renameExpected(
    executionId: string,
    filename: string,
    body: RenameExpectedFileBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<{ name: string }> {
    return this.dispatch(() =>
      agentsExecutionsExpectedRename({
        client: this.client,
        path: { executionId, filename },
        body,
        signal: options.signal,
      })
    );
  }

  async deleteExpected(
    executionId: string,
    filename: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<void> {
    await this.dispatch(() =>
      agentsExecutionsExpectedDelete({
        client: this.client,
        path: { executionId, filename },
        signal: options.signal,
      })
    );
  }

  async uploadExpected(
    executionId: string,
    file: Blob,
    options: { name?: string; signal?: AbortSignal } = {}
  ): Promise<{ name: string }> {
    const formData = new FormData();
    formData.set('file', file);
    if (options.name) formData.set('name', options.name);
    return this.dispatch(
      () =>
        this.client.post({
          url: '/api/v1/agents/executions/{executionId}/expected',
          path: { executionId },
          body: formData,
          bodySerializer: null,
          headers: { 'Content-Type': null },
          signal: options.signal,
        }) as Promise<OperationResult<{ name: string }>>
    );
  }

  async downloadExpected(
    executionId: string,
    filename: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<Blob> {
    return this.downloadBlob(
      () =>
        agentsExecutionsExpectedDownload({
          client: this.client,
          path: { executionId, filename },
          parseAs: 'blob',
          signal: options.signal,
        }) as Promise<OperationResult<Blob>>
    );
  }

  async downloadFile(
    executionId: string,
    kind: AgentExecutionFileKind,
    filename: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<Blob> {
    return this.downloadBlob(
      () =>
        agentsExecutionsFilesDownload({
          client: this.client,
          path: { executionId, kind, filename },
          parseAs: 'blob',
          signal: options.signal,
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

export class AgentsResource {
  public readonly executions: AgentExecutionsResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.executions = new AgentExecutionsResource(client, dispatch);
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
    body: AgentFileBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<{ ok: boolean; path: string }> {
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
    body: AgentFilesBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<{ ok: boolean; files: string[] }> {
    return this.dispatch(() =>
      agentsFilesUploadBatch({
        client: this.client,
        path: { agentId },
        body,
        signal: options.signal,
      })
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
    const query =
      options.waitForCompletion !== undefined
        ? { wait_for_completion: options.waitForCompletion }
        : {};

    if (hasFileInput(input)) {
      const { formData } = buildAgentMultipart(input);
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
        body: { ...(input !== undefined ? { input } : {}) },
        signal: options.signal,
      })
    );
  }
}
