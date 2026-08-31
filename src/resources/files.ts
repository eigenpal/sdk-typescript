import type { OperationResult, RequestDispatchOptions } from '../client';
import type { Client } from '../generated/client';
import {
  filesContentGet,
  filesDelete,
  filesGet,
  filesUploadsAbort,
  filesUploadsComplete,
  filesUploadsCreate,
} from '../generated/sdk.gen';

type Dispatch = <T>(
  call: () => Promise<OperationResult<T>>,
  options?: RequestDispatchOptions
) => Promise<T>;
type AnyResponse = any;
type SignalOptions = { signal?: AbortSignal };
type UploadOptions = SignalOptions & {
  /** Required only when `file` is a nameless Blob. */
  filename?: string;
  /**
   * Tenant-scoped idempotency key for upload-session creation. Generated when
   * omitted so SDK retries of a lost create response reuse the same reservation.
   */
  idempotencyKey?: string;
  /**
   * Optional lifecycle marker. Pass `run-input` for automatic `client.run`
   * pre-uploads so the server can retain them for retries and reap them after 24 hours.
   * Explicit `files.upload` callers should omit this (durable reusable file).
   */
  purpose?: 'run-input';
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
};

const UPLOAD_ABORT_CLEANUP_TIMEOUT_MS = 10_000;

function uploadAbortCleanupSignal(): AbortSignal {
  return AbortSignal.timeout(UPLOAD_ABORT_CLEANUP_TIMEOUT_MS);
}

export type CreateUploadInput = {
  filename: string;
  contentType: string;
  size: number;
  /** Compatible with server `CreateFileUploadSessionRequest.idempotencyKey`. */
  idempotencyKey?: string;
  purpose?: 'run-input';
};

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `upload_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class FilesResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async upload(file: Blob | File, options: UploadOptions = {}): Promise<AnyResponse> {
    const filename =
      options.filename ??
      (typeof File !== 'undefined' && file instanceof File ? file.name : undefined);
    if (!filename) throw new Error('filename is required when uploading a Blob');
    const idempotencyKey = options.idempotencyKey ?? newIdempotencyKey();
    const negotiation = await this.createUpload(
      {
        filename,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        idempotencyKey,
        ...(options.purpose ? { purpose: options.purpose } : {}),
      },
      options
    );

    if (negotiation.transport === 'presigned-put') {
      try {
        const response = await fetch(negotiation.url, {
          method: 'PUT',
          headers: Object.fromEntries(
            Object.entries((negotiation.headers ?? {}) as Record<string, string>).filter(
              ([name]) => name.toLowerCase() !== 'content-length'
            )
          ),
          body: file,
          signal: options.signal,
        });
        if (!response.ok) {
          throw new Error(`Storage upload failed (${response.status}); retry the upload`);
        }
        options.onProgress?.(file.size, file.size);
        return await this.completeUpload(negotiation.uploadId, options);
      } catch (error) {
        // Caller cancellation and response-loss also reach here. Cleanup must
        // not inherit the failed/aborted signal, and must remain bounded.
        await this.abortUpload(negotiation.uploadId, {
          signal: uploadAbortCleanupSignal(),
        }).catch(() => undefined);
        throw error;
      }
    }

    const form = new FormData();
    form.append('file', file, filename);
    if (options.purpose) form.append('purpose', options.purpose);
    const uploaded = await this.dispatch(
      () =>
        this.client.post({
          url: negotiation.url,
          body: form as never,
          bodySerializer: null,
          headers: { 'Content-Type': null },
          signal: options.signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
    options.onProgress?.(file.size, file.size);
    return uploaded;
  }

  async createUpload(input: CreateUploadInput, options: SignalOptions = {}): Promise<AnyResponse> {
    const body = {
      filename: input.filename,
      contentType: input.contentType,
      size: input.size,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      ...(input.purpose ? { purpose: input.purpose } : {}),
    };
    return this.dispatch(() =>
      filesUploadsCreate({
        client: this.client,
        // Server accepts optional idempotencyKey; generated types may lag the schema.
        body: body as never,
        signal: options.signal,
      })
    );
  }

  async completeUpload(uploadId: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      filesUploadsComplete({
        client: this.client,
        path: { uploadId },
        signal: options.signal,
      })
    );
  }

  async abortUpload(uploadId: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      filesUploadsAbort({
        client: this.client,
        path: { uploadId },
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
    return this.dispatch(
      async () => {
        const response = await filesContentGet({
          client: this.client,
          path: { id: fileId },
          parseAs: 'blob',
          signal: options.signal,
        });
        return response as OperationResult<Blob>;
      },
      { responseKind: 'binary' }
    );
  }

  async delete(fileId: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      filesDelete({ client: this.client, path: { id: fileId }, signal: options.signal })
    );
  }
}
