import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import {
  agentsCreate,
  agentsFilesListOrGet,
  agentsFilesPut,
  agentsFilesUploadBatch,
  agentsGet,
  agentsList,
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
  AgentsTriggersEmailCreateAliasData,
  AgentsTriggersEmailCreateAliasResponse,
  AgentsTriggersEmailDeleteAliasResponse,
  AgentsTriggersEmailGetResponse,
  AgentsTriggersEmailListResponse,
  AgentsTriggersEmailUpdateAliasData,
  AgentsTriggersEmailUpdateAliasResponse,
  AgentsTriggersEmailUpdateData,
  AgentsTriggersEmailUpdateResponse,
  CreateAgentBody,
  CreateAgentResponse,
  GetAgentResponse,
  ListAgentVersionsResponse,
  ListAgentsResponse,
  PatchAgentBody,
  PatchAgentResponse,
} from '../generated/types.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;

export interface ListAgentsOptions {
  search?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

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

export class AgentsResource {
  public readonly emailTriggers: AgentEmailTriggersResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
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
}
