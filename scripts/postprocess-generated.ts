import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const packageRoot = join(import.meta.dirname, '..');

function replaceInFile(relativePath: string, from: string, to: string): void {
  const path = join(packageRoot, relativePath);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(from)) {
    throw new Error(`postprocess-generated: expected snippet not found in ${relativePath}`);
  }
  writeFileSync(path, text.replace(from, to));
}

// @hey-api/openapi-ts currently picks the JSON branch when one status can return
// both JSON and binary content. The fetch client handles the runtime response
// body correctly; preserve the public type so `zip=1` callers see a Blob.
replaceInFile(
  'src/generated/types.gen.ts',
  `export type RunsArtifactsListResponses = {
    /**
     * JSON artifact list, or ZIP bytes when \`zip=1\`.
     */
    200: RunArtifactsResponse;
};`,
  `export type RunsArtifactsListResponses = {
    /**
     * JSON artifact list, or ZIP bytes when \`zip=1\`.
     */
    200: RunArtifactsResponse | Blob;
};`
);

// The generator also chooses the JSON request body when an operation accepts
// both JSON and multipart bodies. Keep the generated operation ergonomic for
// file uploads while preserving the JSON copy-file path.
replaceInFile(
  'src/generated/types.gen.ts',
  `export type RunsReviewsExpectedCreateData = {
    body: RunReviewExpectedFileCopyRequest;`,
  `export type RunsReviewsExpectedCreateData = {
    body: RunReviewExpectedFileCopyRequest | RunReviewExpectedFileUploadRequest;`
);

replaceInFile(
  'src/generated/sdk.gen.ts',
  `export const runsReviewsExpectedCreate = <ThrowOnError extends boolean = false>(options: Options<RunsReviewsExpectedCreateData, ThrowOnError>) => (options.client ?? client).post<RunsReviewsExpectedCreateResponses, RunsReviewsExpectedCreateErrors, ThrowOnError>({
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/api/v1/runs/{id}/reviews/expected',
    ...options,
    headers: {
        'Content-Type': 'application/json',
        ...options.headers
    }
});`,
  `export const runsReviewsExpectedCreate = <ThrowOnError extends boolean = false>(options: Options<RunsReviewsExpectedCreateData, ThrowOnError>) => (options.client ?? client).post<RunsReviewsExpectedCreateResponses, RunsReviewsExpectedCreateErrors, ThrowOnError>({
    ...((options.body && typeof options.body === 'object' && 'file' in options.body) ? formDataBodySerializer : {}),
    security: [{ scheme: 'bearer', type: 'http' }],
    url: '/api/v1/runs/{id}/reviews/expected',
    ...options,
    headers: {
        'Content-Type': (options.body && typeof options.body === 'object' && 'file' in options.body) ? null : 'application/json',
        ...options.headers
    }
});`
);
