import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import { authCheck } from '../generated/sdk.gen';
import type { AuthCheckResponse } from '../generated/types.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };

export class AuthResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async check(options: SignalOptions = {}): Promise<AuthCheckResponse> {
    return this.dispatch(() => authCheck({ client: this.client, signal: options.signal }));
  }
}
