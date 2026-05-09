import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import {
  agentsCreate,
  agentsExecutionsCancel,
  agentsExecutionsGet,
  agentsExecutionsList,
  agentsGet,
  agentsList,
  agentsRun,
  agentsUpdate,
} from '../generated/sdk.gen';
import type {
  AgentExecutionResponse,
  CreateAgentBody,
  CreateAgentResponse,
  GetAgentResponse,
  ListAgentExecutionsResponse,
  ListAgentsResponse,
  PatchAgentBody,
  PatchAgentResponse,
  RunAgentResponse,
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
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

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
