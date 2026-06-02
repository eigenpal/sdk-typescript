import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import {
  sourceLockfilePreview,
  sourceRaw,
  sourceReleases,
  sourceRepository,
  sourceSecretsDecrypt,
} from '../generated/sdk.gen';
import type {
  RawSourceResponse,
  SourceLockfileResponse,
  SourceReleasesResponse,
  SourceRepositoryResponse,
  SourceSecretsDecryptBody,
  SourceSecretsDecryptResponse,
} from '../generated/types.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;

export interface SourceRawOptions {
  ref?: string;
  signal?: AbortSignal;
}

export interface SourceReleasesOptions {
  version?: string;
  signal?: AbortSignal;
}

export class SourceResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async repository(options: { signal?: AbortSignal } = {}): Promise<SourceRepositoryResponse> {
    return this.dispatch(() => sourceRepository({ client: this.client, signal: options.signal }));
  }

  async raw(path: string, options: SourceRawOptions = {}): Promise<RawSourceResponse> {
    const { signal, ref = 'main' } = options;
    return this.dispatch(() => sourceRaw({ client: this.client, query: { path, ref }, signal }));
  }

  async releases(
    packagePath: string,
    options: SourceReleasesOptions = {}
  ): Promise<SourceReleasesResponse> {
    const { signal, version } = options;
    return this.dispatch(() =>
      sourceReleases({
        client: this.client,
        query: { packagePath, ...(version !== undefined ? { version } : {}) },
        signal,
      })
    );
  }

  async lockfile(
    packageRef: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<SourceLockfileResponse> {
    return this.dispatch(() =>
      sourceLockfilePreview({
        client: this.client,
        query: { packageRef },
        signal: options.signal,
      })
    );
  }

  async decryptSecrets(
    body: SourceSecretsDecryptBody,
    options: { signal?: AbortSignal } = {}
  ): Promise<SourceSecretsDecryptResponse> {
    return this.dispatch(() =>
      sourceSecretsDecrypt({
        client: this.client,
        body,
        signal: options.signal,
      })
    );
  }
}
