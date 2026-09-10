import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import {
  foldersCreate,
  foldersDelete,
  foldersGet,
  foldersList,
  foldersUpdate,
} from '../generated/sdk.gen';
import type {
  CreateFolderRequest,
  DeleteFolderResponse,
  Folder,
  FoldersListData,
  ListFoldersResponse,
  UpdateFolderRequest,
} from '../generated/types.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };

export type ListFoldersOptions = NonNullable<FoldersListData['query']> & SignalOptions;

export class FoldersResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(options: ListFoldersOptions): Promise<ListFoldersResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      foldersList({
        client: this.client,
        query,
        signal,
      })
    );
  }

  async get(id: string, options: SignalOptions = {}): Promise<Folder> {
    return this.dispatch(() =>
      foldersGet({ client: this.client, path: { id }, signal: options.signal })
    );
  }

  async create(body: CreateFolderRequest, options: SignalOptions = {}): Promise<Folder> {
    return this.dispatch(() =>
      foldersCreate({
        client: this.client,
        body,
        signal: options.signal,
      })
    );
  }

  async update(
    id: string,
    body: UpdateFolderRequest,
    options: SignalOptions = {}
  ): Promise<Folder> {
    return this.dispatch(() =>
      foldersUpdate({
        client: this.client,
        path: { id },
        body,
        signal: options.signal,
      })
    );
  }

  async delete(id: string, options: SignalOptions = {}): Promise<DeleteFolderResponse> {
    return this.dispatch(() =>
      foldersDelete({ client: this.client, path: { id }, signal: options.signal })
    );
  }
}
