import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import { automationsSync } from '../generated/sdk.gen';
import type { AutomationSyncResponse } from '../generated/types.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;

export class AutomationsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async sync(
    automation: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<AutomationSyncResponse> {
    return this.dispatch(() =>
      automationsSync({ client: this.client, path: { automation }, signal: options.signal })
    );
  }
}
