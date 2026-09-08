/**
 * File-input helpers for `client.run()`.
 *
 * A workflow input value is treated as a file when it is one of:
 *   - a Node readable stream — `fs.createReadStream('contract.pdf')`
 *   - a `File` or `Blob`
 *   - a `{ content, filename, mimeType? }` descriptor — build one with `toFile()`
 *
 * File values are auto-detected and uploaded as `multipart/form-data`
 * (matching `curl -F`) — no base64 round-trip.
 */

const DEFAULT_MIME = 'application/octet-stream';

/** Common file extensions → MIME type, for upload filename inference. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  md: 'text/markdown',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** Guess a MIME type from a filename extension; falls back to octet-stream. */
function guessMimeType(filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  return MIME_BY_EXT[ext] ?? DEFAULT_MIME;
}

/**
 * Explicit file descriptor — raw bytes plus metadata. Build one with
 * `toFile()` when you have a `Buffer` / `Uint8Array` / `ArrayBuffer` / `Blob`
 * in memory rather than a path or a stream.
 */
export interface FileDescriptor {
  content: ArrayBuffer | ArrayBufferView | Blob;
  filename: string;
  mimeType?: string;
}

/**
 * Disk path that can be stat'd and re-opened per part for resumable multipart.
 */
export interface PathFileInput {
  path: string;
  filename?: string;
  mimeType?: string;
}

/**
 * Replayable byte-range factory for Node streams that are not a disk path.
 * `open` must return a fresh body for `[start, start+length)` on every call.
 */
export interface StreamFactoryFileInput {
  size: number;
  filename: string;
  mimeType?: string;
  open: (
    start: number,
    length: number
  ) => Blob | Uint8Array | ReadableStream | NodeJS.ReadableStream;
}

/**
 * A Node readable stream — typically `fs.createReadStream('contract.pdf')`.
 * Streams with a `path` are uploaded from disk without draining. A one-shot
 * stream without a path cannot be multipart-resumed.
 */
export interface NodeReadableStream extends AsyncIterable<unknown> {
  /** Source path; used to infer the upload filename. */
  readonly path?: string;
}

/** Any value the SDK accepts as a "file" workflow input. */
export type FileInput =
  | Blob
  | FileDescriptor
  | PathFileInput
  | StreamFactoryFileInput
  | NodeReadableStream;

/**
 * Attach a filename (and optional MIME type) to raw bytes. The escape hatch
 * for when you have a `Buffer` / `ArrayBuffer` / `Blob` in memory rather than
 * a file path or stream.
 *
 * ```ts
 * await client.run('workflows.extract-invoice', {
 *   contract_document: toFile(buffer, 'contract.pdf'),
 * });
 * ```
 */
export function toFile(
  content: ArrayBuffer | ArrayBufferView | Blob,
  filename: string,
  mimeType?: string
): FileDescriptor {
  return { content, filename, mimeType: mimeType ?? guessMimeType(filename) };
}

/** Detect a Node readable stream (`fs.createReadStream`, etc.). */
export function isReadStream(value: unknown): value is NodeReadableStream {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<PropertyKey, unknown>;
  return (
    typeof v[Symbol.asyncIterator] === 'function' &&
    (typeof v.pipe === 'function' || typeof v.read === 'function')
  );
}

/** Detect an explicit `{ content, filename }` descriptor. */
export function isFileDescriptor(value: unknown): value is FileDescriptor {
  if (value === null || typeof value !== 'object') return false;
  const v = value as { content?: unknown; filename?: unknown };
  return (
    typeof v.filename === 'string' &&
    v.content != null &&
    (v.content instanceof ArrayBuffer ||
      ArrayBuffer.isView(v.content) ||
      (typeof Blob !== 'undefined' && v.content instanceof Blob))
  );
}

export function isPathFileInput(value: unknown): value is PathFileInput {
  if (value === null || typeof value !== 'object' || isReadStream(value)) return false;
  const v = value as { path?: unknown; open?: unknown };
  return typeof v.path === 'string' && typeof v.open !== 'function';
}

export function isStreamFactoryFileInput(value: unknown): value is StreamFactoryFileInput {
  if (value === null || typeof value !== 'object') return false;
  const v = value as { open?: unknown; size?: unknown; filename?: unknown };
  return (
    typeof v.open === 'function' &&
    typeof v.filename === 'string' &&
    typeof v.size === 'number' &&
    Number.isFinite(v.size)
  );
}

export function isFileInput(value: unknown): value is FileInput {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (isReadStream(value)) return true;
  if (isPathFileInput(value) || isStreamFactoryFileInput(value)) return true;
  return isFileDescriptor(value);
}

export function hasFileInput(input: Record<string, unknown> | undefined): boolean {
  if (!input) return false;
  for (const value of Object.values(input)) {
    if (isFileInput(value)) return true;
  }
  return false;
}

/** Last path segment of a (possibly nested) file path. */
function basename(path: string): string {
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] || 'file';
}

/**
 * Resolve a `FileInput` to a `{ blob, filename }` pair for `FormData.append`.
 *
 * One-shot streams without a path are drained here so the body can be replayed
 * on HTTP retries. Disk paths and stream factories stay unbuffered until the
 * caller asks for bytes (small multipart leftovers).
 */
export async function resolveFileBlob(file: FileInput): Promise<{ blob: Blob; filename: string }> {
  // `File` extends `Blob`, so this branch covers both.
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    return { blob: file, filename: (file as File).name || 'file' };
  }

  if (isPathFileInput(file) || (isReadStream(file) && typeof file.path === 'string')) {
    const filePath = isPathFileInput(file) ? file.path : file.path!;
    const filename = (isPathFileInput(file) ? file.filename : undefined) ?? basename(filePath);
    if (await pathIsFile(filePath)) {
      const { readFile } = await import('node:fs/promises');
      const bytes = await readFile(filePath);
      const type = (isPathFileInput(file) ? file.mimeType : undefined) ?? guessMimeType(filename);
      return { blob: new Blob([bytes as BlobPart], { type }), filename };
    }
    if (isPathFileInput(file)) {
      throw new Error(`Upload path is not a file: ${filePath}`);
    }
    // Named stream whose path is not readable — drain the in-memory stream.
  }

  if (isStreamFactoryFileInput(file)) {
    const body = file.open(0, file.size);
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return { blob: body, filename: file.filename };
    }
    if (body instanceof Uint8Array) {
      return {
        blob: new Blob([body as BlobPart], { type: file.mimeType ?? guessMimeType(file.filename) }),
        filename: file.filename,
      };
    }
    throw new Error(
      'Stream factory returned a non-Blob body; pass a path or Blob for small multipart leftovers'
    );
  }

  // Node readable stream without a path — drain it into a Blob now.
  if (isReadStream(file)) {
    const filename = typeof file.path === 'string' ? basename(file.path) : 'file';
    const parts: BlobPart[] = [];
    for await (const chunk of file) {
      parts.push(chunk as BlobPart);
    }
    return { blob: new Blob(parts, { type: guessMimeType(filename) }), filename };
  }

  // Explicit descriptor.
  const desc = file as FileDescriptor;
  const type = desc.mimeType ?? DEFAULT_MIME;
  if (!(desc.content instanceof Blob)) {
    // ArrayBuffer / ArrayBufferView — wrap the bytes in a typed Blob.
    return { blob: new Blob([desc.content as BlobPart], { type }), filename: desc.filename };
  }
  // Already a Blob — reuse it, re-slicing only to apply a different MIME type.
  const blob =
    desc.content.type === type ? desc.content : desc.content.slice(0, desc.content.size, type);
  return { blob, filename: desc.filename };
}

export async function statUploadSize(
  file: FileInput
): Promise<{ size: number; filename: string; contentType: string }> {
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    return {
      size: file.size,
      filename: (file as File).name || 'file',
      contentType: file.type || DEFAULT_MIME,
    };
  }
  if (isPathFileInput(file) || (isReadStream(file) && typeof file.path === 'string')) {
    const filePath = isPathFileInput(file) ? file.path : file.path!;
    const filename = (isPathFileInput(file) ? file.filename : undefined) ?? basename(filePath);
    if (await pathIsFile(filePath)) {
      const { stat } = await import('node:fs/promises');
      const info = await stat(filePath);
      return {
        size: info.size,
        filename,
        contentType: (isPathFileInput(file) ? file.mimeType : undefined) ?? guessMimeType(filename),
      };
    }
    if (isPathFileInput(file)) {
      throw new Error(`Upload path is not a file: ${filePath}`);
    }
  }
  if (isStreamFactoryFileInput(file)) {
    return {
      size: file.size,
      filename: file.filename,
      contentType: file.mimeType ?? guessMimeType(file.filename),
    };
  }
  if (isFileDescriptor(file)) {
    const size =
      file.content instanceof Blob
        ? file.content.size
        : file.content instanceof ArrayBuffer
          ? file.content.byteLength
          : file.content.byteLength;
    return {
      size,
      filename: file.filename,
      contentType: file.mimeType ?? guessMimeType(file.filename),
    };
  }
  throw new Error(
    'Cannot determine size of a non-replayable stream. Pass a file path, Blob, or a stream factory with size.'
  );
}

export function isReplayableUploadSource(file: FileInput | Uint8Array | ArrayBuffer): boolean {
  if (file instanceof Uint8Array || file instanceof ArrayBuffer) return true;
  if (typeof Blob !== 'undefined' && file instanceof Blob) return true;
  if (isPathFileInput(file) || isStreamFactoryFileInput(file) || isFileDescriptor(file))
    return true;
  return isReadStream(file) && typeof file.path === 'string';
}

async function pathIsFile(filePath: string): Promise<boolean> {
  try {
    const { stat } = await import('node:fs/promises');
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export interface MultipartParts {
  /** FormData ready to send as the request body. */
  formData: FormData;
  /** Number of file fields appended (0 means no files were detected). */
  fileCount: number;
}

/** Drain `input` into a FormData, appending each detected file as `files.<name>`. */
async function appendFiles(
  fd: FormData,
  input: Record<string, unknown> | undefined
): Promise<{ scalars: Record<string, unknown>; fileCount: number }> {
  const scalars: Record<string, unknown> = {};
  let fileCount = 0;
  for (const [key, value] of Object.entries(input ?? {})) {
    if (isFileInput(value)) {
      const { blob, filename } = await resolveFileBlob(value);
      fd.append(`files.${key}`, blob, filename);
      fileCount += 1;
    } else {
      scalars[key] = value;
    }
  }
  return { scalars, fileCount };
}

/**
 * JSON-body counterpart of {@link buildRunMultipart}: canonical envelope
 * `{ target, input, overrides?, metadata? }`.
 */
export function buildRunJsonBody(
  target: string,
  input: Record<string, unknown> | undefined,
  overrides?: { steps?: Record<string, Record<string, unknown>> },
  metadata?: Record<string, unknown>
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    target,
    input: input ?? {},
  };
  if (overrides) body.overrides = overrides;
  if (metadata) body.metadata = metadata;
  return body;
}

/**
 * Build multipart for the canonical `client.run(...)` endpoint
 * (`POST /api/v1/runs`):
 *
 *   - `target` is a required text field.
 *   - Scalar inputs go in the `input` JSON text field.
 *   - Each top-level file in `input` becomes `files.<fieldName>`.
 *   - Per-step overrides and caller metadata use `overrides` / `metadata` JSON parts.
 *
 * Async because stream inputs are drained to bytes here. Only top-level file
 * values are extracted — files nested inside arrays / objects keep their
 * position in the JSON sidecar (the server has no nested-upload path).
 */
export async function buildRunMultipart(args: {
  target: string;
  input?: Record<string, unknown>;
  overrides?: { steps?: Record<string, Record<string, unknown>> };
  metadata?: Record<string, unknown>;
}): Promise<MultipartParts> {
  const fd = new FormData();
  fd.append('target', args.target);
  const { scalars, fileCount } = await appendFiles(fd, args.input);
  fd.append('input', JSON.stringify(scalars));
  if (args.overrides) {
    fd.append('overrides', JSON.stringify(args.overrides));
  }
  if (args.metadata) {
    fd.append('metadata', JSON.stringify(args.metadata));
  }
  return { formData: fd, fileCount };
}

/** Build multipart for endpoints that accept one file field plus optional name. */
export async function buildSingleFileMultipart(file: FileInput, name?: string): Promise<FormData> {
  const fd = new FormData();
  const { blob, filename } = await resolveFileBlob(file);
  fd.append('file', blob, filename);
  if (name) fd.append('name', name);
  return fd;
}
