/**
 * File-input helpers for `client.workflows.run()`.
 *
 * Pass a `File`, `Blob`, or explicit `{ content, filename, mimeType }` triple
 * as a workflow input value. The SDK auto-detects file values and uploads
 * them as `multipart/form-data` — matching `curl -F`. No base64 needed.
 */

/**
 * Explicit file descriptor — raw bytes plus metadata. Use when you have a
 * `Buffer` / `Uint8Array` / `ArrayBuffer` and want to set the filename /
 * mime type yourself (a bare `Blob` has no filename).
 *
 * ```ts
 * await client.workflows.run('extract-invoice', {
 *   contract_document: {
 *     content: buffer,
 *     filename: 'contract.pdf',
 *     mimeType: 'application/pdf',
 *   },
 * });
 * ```
 */
export interface FileDescriptor {
  content: ArrayBuffer | ArrayBufferView | Blob;
  filename: string;
  mimeType?: string;
}

/**
 * Any value that the SDK accepts as a "file" workflow input.
 */
export type FileInput = Blob | FileDescriptor;

const DEFAULT_MIME = 'application/octet-stream';

export function isFileInput(value: unknown): value is FileInput {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (value !== null && typeof value === 'object') {
    const v = value as { content?: unknown; filename?: unknown };
    if (
      typeof v.filename === 'string' &&
      v.content != null &&
      (v.content instanceof ArrayBuffer ||
        ArrayBuffer.isView(v.content) ||
        (typeof Blob !== 'undefined' && v.content instanceof Blob))
    ) {
      return true;
    }
  }
  return false;
}

export function hasFileInput(input: Record<string, unknown> | undefined): boolean {
  if (!input) return false;
  for (const value of Object.values(input)) {
    if (isFileInput(value)) return true;
  }
  return false;
}

/** Convert a `FileInput` to `{ blob, filename }` for `FormData.append`. */
function toBlobAndFilename(file: FileInput): { blob: Blob; filename: string } {
  // File extends Blob, so the Blob branch covers it.
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    const name = (file as File).name ?? 'file';
    return { blob: file, filename: name };
  }
  const desc = file as FileDescriptor;
  const content = desc.content;
  const type = desc.mimeType ?? DEFAULT_MIME;
  let blob: Blob;
  if (content instanceof Blob) {
    blob = type && content.type !== type ? content.slice(0, content.size, type) : content;
  } else {
    // ArrayBuffer or ArrayBufferView — wrap in a Blob.
    blob = new Blob([content as BlobPart], { type });
  }
  return { blob, filename: desc.filename };
}

export interface MultipartParts {
  /** FormData ready to send as the request body. */
  formData: FormData;
  /** Number of file fields appended (0 means no files were detected). */
  fileCount: number;
}

/**
 * Build a `multipart/form-data` body that matches what
 * `processMultipartRunBody` on the server expects:
 *
 *   - Each file in `input` becomes a top-level form field (key = input name).
 *   - Non-file inputs + overrides + trigger go in a `_json` text field.
 *
 * Only top-level file values are extracted. Files nested inside arrays /
 * objects keep their position in the JSON sidecar — the server doesn't
 * support nested file uploads via multipart.
 */
export function buildMultipart(args: {
  input?: Record<string, unknown>;
  overrides?: { steps?: Record<string, Record<string, unknown>> };
  trigger?: 'api' | 'cli';
}): MultipartParts {
  const fd = new FormData();
  const inputScalars: Record<string, unknown> = {};
  let fileCount = 0;

  for (const [key, value] of Object.entries(args.input ?? {})) {
    if (isFileInput(value)) {
      const { blob, filename } = toBlobAndFilename(value);
      fd.append(key, blob, filename);
      fileCount += 1;
    } else {
      inputScalars[key] = value;
    }
  }

  const sidecar: Record<string, unknown> = {};
  if (Object.keys(inputScalars).length > 0) sidecar.input = inputScalars;
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
export function buildAgentMultipart(input?: Record<string, unknown>): MultipartParts {
  const fd = new FormData();
  const inputScalars: Record<string, unknown> = {};
  let fileCount = 0;

  for (const [key, value] of Object.entries(input ?? {})) {
    if (isFileInput(value)) {
      const { blob, filename } = toBlobAndFilename(value);
      fd.append(key, blob, filename);
      fileCount += 1;
    } else {
      inputScalars[key] = value;
    }
  }

  if (Object.keys(inputScalars).length > 0) {
    fd.append('_json', JSON.stringify(inputScalars));
  }

  return { formData: fd, fileCount };
}
