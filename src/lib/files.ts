/**
 * File-input helpers for `client.workflows.run()` (and agent runs).
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
 * A Node readable stream — typically `fs.createReadStream('contract.pdf')`.
 * The SDK drains it and infers the upload filename from `path`.
 */
export interface NodeReadableStream extends AsyncIterable<unknown> {
  /** Source path; used to infer the upload filename. */
  readonly path?: string;
}

/** Any value the SDK accepts as a "file" workflow input. */
export type FileInput = Blob | FileDescriptor | NodeReadableStream;

/**
 * Attach a filename (and optional MIME type) to raw bytes. The escape hatch
 * for when you have a `Buffer` / `ArrayBuffer` / `Blob` in memory rather than
 * a file path or stream.
 *
 * ```ts
 * await client.workflows.run('extract-invoice', {
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
function isReadStream(value: unknown): value is NodeReadableStream {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<PropertyKey, unknown>;
  return (
    typeof v[Symbol.asyncIterator] === 'function' &&
    (typeof v.pipe === 'function' || typeof v.read === 'function')
  );
}

/** Detect an explicit `{ content, filename }` descriptor. */
function isFileDescriptor(value: unknown): value is FileDescriptor {
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

export function isFileInput(value: unknown): value is FileInput {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (isReadStream(value)) return true;
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
 * Streams are drained to bytes *here* — eagerly, before the request is sent —
 * so the body can be replayed if the SDK retries the request. (A consumed
 * stream cannot be re-read; a Blob can.)
 */
async function resolveFileBlob(file: FileInput): Promise<{ blob: Blob; filename: string }> {
  // `File` extends `Blob`, so this branch covers both.
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    return { blob: file, filename: (file as File).name || 'file' };
  }

  // Node readable stream — drain it into a Blob now.
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

export interface MultipartParts {
  /** FormData ready to send as the request body. */
  formData: FormData;
  /** Number of file fields appended (0 means no files were detected). */
  fileCount: number;
}

/** Drain `input` into a FormData, appending each detected file as a field. */
async function appendFiles(
  fd: FormData,
  input: Record<string, unknown> | undefined
): Promise<{ scalars: Record<string, unknown>; fileCount: number }> {
  const scalars: Record<string, unknown> = {};
  let fileCount = 0;
  for (const [key, value] of Object.entries(input ?? {})) {
    if (isFileInput(value)) {
      const { blob, filename } = await resolveFileBlob(value);
      fd.append(key, blob, filename);
      fileCount += 1;
    } else {
      scalars[key] = value;
    }
  }
  return { scalars, fileCount };
}

/**
 * Build a `multipart/form-data` body matching what `processMultipartRunBody`
 * on the server expects:
 *
 *   - Each file in `input` becomes a top-level form field (key = input name).
 *   - Non-file inputs + overrides + trigger go in a `_json` text field.
 *
 * Async because stream inputs are drained to bytes here. Only top-level file
 * values are extracted — files nested inside arrays / objects keep their
 * position in the JSON sidecar (the server has no nested-upload path).
 */
export async function buildMultipart(args: {
  input?: Record<string, unknown>;
  overrides?: { steps?: Record<string, Record<string, unknown>> };
  trigger?: 'api' | 'cli';
}): Promise<MultipartParts> {
  const fd = new FormData();
  const { scalars, fileCount } = await appendFiles(fd, args.input);

  const sidecar: Record<string, unknown> = {};
  if (Object.keys(scalars).length > 0) sidecar.input = scalars;
  if (args.overrides) sidecar.overrides = args.overrides;
  if (args.trigger) sidecar.trigger = args.trigger;
  if (Object.keys(sidecar).length > 0) {
    fd.append('_json', JSON.stringify(sidecar));
  }

  return { formData: fd, fileCount };
}

/**
 * Build multipart for agent runs. Agent run endpoints consume `_json` as the
 * input object itself, unlike workflow runs where `_json` is a sidecar with
 * `{ input, overrides, trigger }`.
 */
export async function buildAgentMultipart(
  input?: Record<string, unknown>
): Promise<MultipartParts> {
  const fd = new FormData();
  const { scalars, fileCount } = await appendFiles(fd, input);

  if (Object.keys(scalars).length > 0) {
    fd.append('_json', JSON.stringify(scalars));
  }

  return { formData: fd, fileCount };
}
