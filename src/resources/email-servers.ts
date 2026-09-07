import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import {
  emailServersCreate,
  emailServersDelete,
  emailServersGet,
  emailServersList,
  emailServersTest,
  emailServersUpdate,
} from '../generated/sdk.gen';
import type {
  CreateEmailServerRequest,
  DeleteEmailServerResponse,
  EmailServer,
  EmailServersListData,
  ListEmailServersResponse,
  TestEmailServerRequest,
  TestEmailServerResponse,
  UpdateEmailServerRequest,
} from '../generated/types.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };

export type ListEmailServersOptions = NonNullable<EmailServersListData['query']> & SignalOptions;

export class EmailServersResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(options: ListEmailServersOptions = {}): Promise<ListEmailServersResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      emailServersList({
        client: this.client,
        query,
        signal,
      })
    );
  }

  async get(id: string, options: SignalOptions = {}): Promise<EmailServer> {
    return this.dispatch(() =>
      emailServersGet({ client: this.client, path: { id }, signal: options.signal })
    );
  }

  async create(body: CreateEmailServerRequest, options: SignalOptions = {}): Promise<EmailServer> {
    return this.dispatch(() =>
      emailServersCreate({
        client: this.client,
        body,
        signal: options.signal,
      })
    );
  }

  async update(
    id: string,
    body: UpdateEmailServerRequest,
    options: SignalOptions = {}
  ): Promise<EmailServer> {
    return this.dispatch(() =>
      emailServersUpdate({
        client: this.client,
        path: { id },
        body,
        signal: options.signal,
      })
    );
  }

  async delete(id: string, options: SignalOptions = {}): Promise<DeleteEmailServerResponse> {
    return this.dispatch(() =>
      emailServersDelete({ client: this.client, path: { id }, signal: options.signal })
    );
  }

  async test(
    id: string,
    body: TestEmailServerRequest,
    options: SignalOptions = {}
  ): Promise<TestEmailServerResponse> {
    return this.dispatch(() =>
      emailServersTest({
        client: this.client,
        path: { id },
        body,
        signal: options.signal,
      })
    );
  }
}
