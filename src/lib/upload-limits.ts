/**
 * Default to Vercel's ~4.5 MiB function body limit. Operators with a different
 * ingress limit can override it; `null` keeps every run file on multipart.
 */
export const DEFAULT_MULTIPART_MAX_BYTES = Math.floor(4.5 * 1024 * 1024);
/** @deprecated Use {@link DEFAULT_MULTIPART_MAX_BYTES}. */
export const DIRECT_UPLOAD_BYTE_THRESHOLD = DEFAULT_MULTIPART_MAX_BYTES;

/**
 * Conservative allowance for multipart boundaries, `target` / `input` /
 * `overrides` / `metadata` parts, and Content-Disposition headers.
 */
export const MULTIPART_ENVELOPE_HEADROOM_BYTES = 256 * 1024;

/** Max aggregate file-content bytes that may ride in one multipart run request. */
export function multipartFileByteBudget(
  multipartMaxBytes: number | null = DEFAULT_MULTIPART_MAX_BYTES
): number | null {
  if (multipartMaxBytes === null) return null;
  return Math.max(0, multipartMaxBytes - MULTIPART_ENVELOPE_HEADROOM_BYTES);
}

/**
 * Choose which file keys must be pre-uploaded so remaining multipart file
 * bytes plus envelope headroom stay under the configured multipart maximum.
 *
 * Prefers shedding the largest files first so smaller ones can stay on the
 * single multipart round-trip when the aggregate still fits.
 */
export function keysRequiringPreUpload(
  files: ReadonlyArray<{ key: string; size: number }>,
  multipartMaxBytes: number | null = DEFAULT_MULTIPART_MAX_BYTES
): Set<string> {
  const budget = multipartFileByteBudget(multipartMaxBytes);
  const toPreUpload = new Set<string>();
  if (budget === null) return toPreUpload;

  for (const file of files) {
    if (file.size > budget) {
      toPreUpload.add(file.key);
    }
  }

  let multipartTotal = 0;
  for (const file of files) {
    if (!toPreUpload.has(file.key)) multipartTotal += file.size;
  }

  const candidates = files
    .filter((file) => !toPreUpload.has(file.key))
    .slice()
    .sort((a, b) => b.size - a.size || a.key.localeCompare(b.key));

  for (const file of candidates) {
    if (multipartTotal <= budget) break;
    toPreUpload.add(file.key);
    multipartTotal -= file.size;
  }

  return toPreUpload;
}
