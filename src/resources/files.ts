import type { OperationResult, RequestDispatchOptions } from '../client';
import type { Client } from '../generated/client';
import {
  filesContentGet,
  filesDelete,
  filesGet,
  filesUploadsAbort,
  filesUploadsComplete,
  filesUploadsCreate,
  filesUploadsGet,
  filesUploadsPartsList,
  filesUploadsPartsPresign,
} from '../generated/sdk.gen';
import {
  byteViewToArrayBuffer,
  destroyUnreadNodeReadable,
  ensureNodeReadableFullySent,
  isNodeReadableStream,
  toPutBody,
  type StreamableRequestInit,
} from '../lib/fetch-body';
import {
  isFileDescriptor,
  isFileInput,
  isPathFileInput,
  isStreamFactoryFileInput,
  resolveFileBlob,
  statUploadSize,
  type FileInput,
} from '../lib/files';
import {
  annotateMultipartCompleteFailure,
  annotatePresignedPutCompleteFailure,
  filterStorageHeaders,
  PartUploadHttpError,
  shouldAbortMultipartUploadSession,
  shouldAbortPresignedPutUploadSession,
  uploadPresignedMultipartParts,
  type ListedUploadPart,
} from '../lib/upload-presigned-multipart';

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

type UploadableFile = FileInput | Uint8Array | ArrayBuffer;

export class FilesResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async upload(file: UploadableFile, options: UploadOptions = {}): Promise<AnyResponse> {
    const source = await resolveUploadableSource(file, options.filename);
    const idempotencyKey = options.idempotencyKey ?? newIdempotencyKey();
    const negotiation = await this.createUpload(
      {
        filename: source.filename,
        contentType: source.contentType,
        size: source.size,
        idempotencyKey,
        ...(options.purpose ? { purpose: options.purpose } : {}),
      },
      options
    );

    if (negotiation.transport === 'presigned-multipart') {
      if (!source.replayable) {
        throw new Error(
          'Cannot resume a multipart upload from a one-shot stream. Pass a file path, Blob, or a reusable stream factory.'
        );
      }
      let partsReady = false;
      try {
        await uploadPresignedMultipartParts({
          partCount: negotiation.partCount,
          partSizeBytes: negotiation.partSizeBytes,
          totalSize: source.size,
          signal: options.signal,
          onProgress: options.onProgress,
          listParts: async () => {
            const listed = await this.dispatch(
              () =>
                this.client.get({
                  url: negotiation.partsUrl,
                  signal: options.signal,
                }) as Promise<OperationResult<{ parts?: ListedUploadPart[] }>>
            );
            return listed.parts ?? [];
          },
          presignPart: async (partNumber) => {
            return this.dispatch(
              () =>
                this.client.post({
                  url: negotiation.partsUrl,
                  body: { partNumber } as never,
                  signal: options.signal,
                }) as Promise<
                  OperationResult<{
                    url: string;
                    headers?: Record<string, string>;
                    partSizeBytes: number;
                  }>
                >
            );
          },
          putPart: async ({ url, headers, start, length }) => {
            const body = await source.openPart(start, length);
            const response = await putStorage(
              url,
              headers,
              body,
              options.signal,
              source.stripContentLength,
              length
            );
            if (!response.ok) throw new PartUploadHttpError(response.status);
          },
        });
        partsReady = true;
        return await this.dispatch(
          () =>
            this.client.post({
              url: negotiation.completeUrl,
              body: {} as never,
              signal: options.signal,
            }) as Promise<OperationResult<AnyResponse>>
        );
      } catch (error) {
        if (shouldAbortMultipartUploadSession({ partsReady })) {
          await this.abortUpload(negotiation.uploadId, {
            signal: uploadAbortCleanupSignal(),
          }).catch(() => undefined);
          throw error;
        }
        throw annotateMultipartCompleteFailure(negotiation.uploadId, error);
      }
    }

    if (negotiation.transport === 'presigned-put') {
      let putReady = false;
      try {
        const body = await source.openPart(0, source.size);
        const response = await putStorage(
          negotiation.url,
          (negotiation.headers ?? {}) as Record<string, string>,
          body,
          options.signal,
          source.stripContentLength,
          source.size
        );
        if (!response.ok) {
          throw new Error(`Storage upload failed (${response.status}); retry the upload`);
        }
        putReady = true;
        options.onProgress?.(source.size, source.size);
      } catch (error) {
        if (shouldAbortPresignedPutUploadSession({ putReady })) {
          await this.abortUpload(negotiation.uploadId, {
            signal: uploadAbortCleanupSignal(),
          }).catch(() => undefined);
        }
        throw error;
      }
      try {
        return await this.completeUpload(negotiation.uploadId, options);
      } catch (error) {
        throw annotatePresignedPutCompleteFailure(negotiation.uploadId, error);
      }
    }

    const blob = await source.asBlob();
    const form = new FormData();
    form.append('file', blob, source.filename);
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
    options.onProgress?.(source.size, source.size);
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

  async getUpload(uploadId: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      filesUploadsGet({
        client: this.client,
        path: { uploadId },
        signal: options.signal,
      })
    );
  }

  async listUploadParts(uploadId: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      filesUploadsPartsList({
        client: this.client,
        path: { uploadId },
        signal: options.signal,
      })
    );
  }

  async presignUploadPart(
    uploadId: string,
    partNumber: number,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      filesUploadsPartsPresign({
        client: this.client,
        path: { uploadId },
        body: { partNumber },
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

type ResolvedUploadSource = {
  filename: string;
  contentType: string;
  size: number;
  replayable: boolean;
  stripContentLength: boolean;
  openPart: (start: number, length: number) => Promise<BodyInit>;
  asBlob: () => Promise<Blob>;
};

async function resolveUploadableSource(
  file: UploadableFile,
  filenameOption?: string
): Promise<ResolvedUploadSource> {
  if (file instanceof Uint8Array) {
    const filename = filenameOption || 'file';
    return {
      filename,
      contentType: 'application/octet-stream',
      size: file.byteLength,
      replayable: true,
      stripContentLength: false,
      openPart: async (start, length) =>
        byteViewToArrayBuffer(file.subarray(start, start + length)),
      asBlob: async () => new Blob([file as BlobPart]),
    };
  }
  if (file instanceof ArrayBuffer) {
    const filename = filenameOption || 'file';
    const bytes = new Uint8Array(file);
    return {
      filename,
      contentType: 'application/octet-stream',
      size: bytes.byteLength,
      replayable: true,
      stripContentLength: false,
      openPart: async (start, length) =>
        byteViewToArrayBuffer(bytes.subarray(start, start + length)),
      asBlob: async () => new Blob([bytes as BlobPart]),
    };
  }

  if (!isFileInput(file)) {
    throw new Error('filename is required when uploading a Blob');
  }

  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    const filename =
      filenameOption ??
      (typeof File !== 'undefined' && file instanceof File ? file.name : undefined);
    if (!filename) throw new Error('filename is required when uploading a Blob');
    return {
      filename,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      replayable: true,
      stripContentLength: true,
      openPart: async (start, length) => file.slice(start, start + length),
      asBlob: async () => file,
    };
  }

  if (isPathFileInput(file) || hasNodePath(file)) {
    const filePath = isPathFileInput(file) ? file.path : (file as { path: string }).path;
    const meta = await statUploadSize(file);
    const filename = filenameOption || meta.filename;
    return {
      filename,
      contentType: meta.contentType,
      size: meta.size,
      replayable: true,
      stripContentLength: false,
      openPart: async (start, length) => {
        if (length === 0) return byteViewToArrayBuffer(new Uint8Array());
        const { createReadStream } = await import('node:fs');
        return toPutBody(
          createReadStream(filePath, {
            start,
            end: start + length - 1,
          })
        );
      },
      asBlob: async () => (await resolveFileBlob(file)).blob,
    };
  }

  if (isStreamFactoryFileInput(file)) {
    return {
      filename: filenameOption || file.filename,
      contentType: file.mimeType || 'application/octet-stream',
      size: file.size,
      replayable: true,
      stripContentLength: false,
      openPart: async (start, length) => {
        const part = file.open(start, length);
        if (part instanceof Uint8Array) return byteViewToArrayBuffer(part);
        if (isNodeReadableStream(part)) return toPutBody(part);
        return part;
      },
      asBlob: async () => (await resolveFileBlob(file)).blob,
    };
  }

  if (isFileDescriptor(file)) {
    const filename = filenameOption || file.filename;
    const type = file.mimeType || 'application/octet-stream';
    if (typeof Blob !== 'undefined' && file.content instanceof Blob) {
      const blob = file.content;
      return {
        filename,
        contentType: type,
        size: blob.size,
        replayable: true,
        stripContentLength: true,
        openPart: async (start, length) => blob.slice(start, start + length),
        asBlob: async () => blob,
      };
    }
    const bytes =
      file.content instanceof ArrayBuffer
        ? new Uint8Array(file.content)
        : new Uint8Array(
            (file.content as ArrayBufferView).buffer,
            (file.content as ArrayBufferView).byteOffset,
            (file.content as ArrayBufferView).byteLength
          );
    return {
      filename,
      contentType: type,
      size: bytes.byteLength,
      replayable: true,
      stripContentLength: false,
      openPart: async (start, length) =>
        byteViewToArrayBuffer(bytes.subarray(start, start + length)),
      asBlob: async () => new Blob([bytes as BlobPart], { type }),
    };
  }

  throw new Error(
    'Cannot upload a one-shot stream. Pass a file path, Blob, or a reusable stream factory.'
  );
}

function hasNodePath(file: FileInput): file is FileInput & { path: string } {
  return typeof (file as { path?: unknown }).path === 'string';
}

async function putStorage(
  url: string,
  headers: Record<string, string>,
  body: BodyInit,
  signal: AbortSignal | undefined,
  stripContentLength: boolean,
  expectedByteLength?: number
): Promise<Response> {
  const stream = isNodeReadableStream(body);
  const init: StreamableRequestInit = {
    method: 'PUT',
    headers: filterStorageHeaders(headers, stripContentLength && !stream),
    body,
    signal,
    ...(stream ? { duplex: 'half' as const } : {}),
  };
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (stream) destroyUnreadNodeReadable(body as NodeJS.ReadableStream);
    throw error;
  }
  if (stream) {
    await ensureNodeReadableFullySent(body as NodeJS.ReadableStream, expectedByteLength);
  }
  return response;
}
