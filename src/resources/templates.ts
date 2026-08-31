import type { OperationResult, RequestDispatchOptions } from '../client';
import type { Client } from '../generated/client';
import {
  templatesContentGet,
  templatesDelete,
  templatesGet,
  templatesList,
} from '../generated/sdk.gen';
import type { ListTemplatesResponse, Template } from '../generated/types.gen';
import type { FilesResource } from './files';

type Dispatch = <T>(
  call: () => Promise<OperationResult<T>>,
  options?: RequestDispatchOptions
) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };
type UploadOptions = SignalOptions & {
  /** Required only when `file` is a nameless Blob. */
  filename?: string;
  name?: string;
  description?: string;
};
type FileIdOptions = SignalOptions & {
  name?: string;
  description?: string;
};

const TEMPORARY_UPLOAD_CLEANUP_TIMEOUT_MS = 10_000;

function temporaryUploadCleanupSignal(): AbortSignal {
  return AbortSignal.timeout(TEMPORARY_UPLOAD_CLEANUP_TIMEOUT_MS);
}

function filenameFor(file: Blob | File, filename?: string): string {
  const resolved =
    filename ?? (typeof File !== 'undefined' && file instanceof File ? file.name : undefined);
  if (!resolved) throw new Error('filename is required when uploading a Blob');
  return resolved;
}

export class TemplatesResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch,
    private readonly files: FilesResource
  ) {}

  async list(
    options: SignalOptions & { limit?: number; offset?: number } = {}
  ): Promise<ListTemplatesResponse> {
    return this.dispatch(() =>
      templatesList({
        client: this.client,
        query: { limit: options.limit, offset: options.offset },
        signal: options.signal,
      })
    );
  }

  async get(templateId: string, options: SignalOptions = {}): Promise<Template> {
    return this.dispatch(() =>
      templatesGet({ client: this.client, path: { id: templateId }, signal: options.signal })
    );
  }

  async create(file: Blob | File, options: UploadOptions = {}): Promise<Template> {
    const uploaded = await this.files.upload(file, {
      filename: filenameFor(file, options.filename),
      signal: options.signal,
    });
    try {
      return await this.createFromFileId(uploaded.id, options);
    } finally {
      await this.files
        .delete(uploaded.id, { signal: temporaryUploadCleanupSignal() })
        .catch(() => undefined);
    }
  }

  /** Create a template from an existing reusable `file_…` resource. */
  async createFromFileId(fileId: string, options: FileIdOptions = {}): Promise<Template> {
    return this.dispatch(
      () =>
        this.client.post({
          url: '/v1/templates',
          body: {
            fileId,
            name: options.name,
            description: options.description,
          },
          signal: options.signal,
        }) as Promise<OperationResult<Template>>
    );
  }

  async replace(
    templateId: string,
    file: Blob | File,
    options: Pick<UploadOptions, 'filename' | 'signal'> = {}
  ): Promise<Template> {
    const uploaded = await this.files.upload(file, {
      filename: filenameFor(file, options.filename),
      signal: options.signal,
    });
    try {
      return await this.replaceFromFileId(templateId, uploaded.id, options);
    } finally {
      await this.files
        .delete(uploaded.id, { signal: temporaryUploadCleanupSignal() })
        .catch(() => undefined);
    }
  }

  /** Append a revision from an existing reusable `file_…` resource. */
  async replaceFromFileId(
    templateId: string,
    fileId: string,
    options: SignalOptions = {}
  ): Promise<Template> {
    return this.dispatch(
      () =>
        this.client.put({
          url: '/v1/templates/{id}',
          path: { id: templateId },
          body: { fileId },
          signal: options.signal,
        }) as Promise<OperationResult<Template>>
    );
  }

  async download(
    templateId: string,
    options: SignalOptions & { revisionId?: string } = {}
  ): Promise<Blob> {
    return this.dispatch(
      async () =>
        (await templatesContentGet({
          client: this.client,
          path: { id: templateId },
          query: { revisionId: options.revisionId },
          parseAs: 'blob',
          signal: options.signal,
        })) as OperationResult<Blob>,
      { responseKind: 'binary' }
    );
  }

  async delete(templateId: string, options: SignalOptions = {}): Promise<{ deleted: boolean }> {
    return this.dispatch(() =>
      templatesDelete({ client: this.client, path: { id: templateId }, signal: options.signal })
    );
  }
}
