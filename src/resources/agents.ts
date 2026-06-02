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
  agentsRunsFilesDownload,
  agentsRunsGet,
  agentsRunsList,
  agentsRunsRerun,
  agentsUpdate,
} from '../generated/sdk.gen';
import type {
  AgentExecutionExpectedArtifacts,
  AgentExecutionFeedbackDetail,
  AgentRunResponse,
  CancelAgentExecutionResponse,
  CopyAgentExecutionOutputToExpectedBody,
  CreateAgentBody,
  CreateAgentResponse,
  GetAgentResponse,
  ListAgentRunsResponse,
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

export type AgentExecutionFileKind = 'input' | 'output' | 'issues' | 'trace';

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
    options: { signal?: AbortSignal } = {}
  ): Promise<RerunAgentRunResponse> {
    return this.dispatch(() =>
      agentsRunsRerun({
        client: this.client,
        path: { runId },
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
    kind: AgentExecutionFileKind,
    filename: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<Blob> {
    return this.downloadBlob(
      () =>
        agentsRunsFilesDownload({
          client: this.client,
          path: { runId, kind, filename },
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
  public readonly runs: AgentRunsResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.runs = new AgentRunsResource(client, dispatch);
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
