import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import { filesContentGet, filesCreate, filesDelete, filesGet } from '../generated/sdk.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;
type AnyResponse = any;
type SignalOptions = { signal?: AbortSignal };

export class FilesResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async upload(file: Blob | File, options: SignalOptions = {}): Promise<AnyResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.dispatch(() =>
      filesCreate({
        client: this.client,
        body: form as never,
        bodySerializer: null,
        headers: { 'Content-Type': null },
        signal: options.signal,
      })
    );
  }

  async get(fileId: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      filesGet({ client: this.client, path: { id: fileId }, signal: options.signal })
    );
  }

  async download(fileId: string, options: SignalOptions = {}): Promise<Blob> {
    return this.dispatch(async () => {
      const response = await filesContentGet({
        client: this.client,
        path: { id: fileId },
        signal: options.signal,
      });
      return response as OperationResult<Blob>;
    });
  }

  async delete(fileId: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      filesDelete({ client: this.client, path: { id: fileId }, signal: options.signal })
    );
  }
}
