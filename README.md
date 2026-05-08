# @eigenpal/sdk

Official TypeScript SDK for the [EigenPal](https://eigenpal.com) API.

```bash
npm install @eigenpal/sdk
```

```ts
import { Eigenpal } from '@eigenpal/sdk';

const client = new Eigenpal({
  apiKey: process.env.EIGENPAL_API_KEY,
});

// Pass a File / Blob / { content, filename, mimeType }. The SDK uploads
// the request as multipart/form-data, no base64 needed.
const result = await client.executions.runAndWait('extract-invoice', {
  contract_document: file,
});
console.log(result.status, result.result);
```

## Authentication

Generate an API key from the dashboard under **Settings → API Keys**, then pass it explicitly:

```ts
const client = new Eigenpal({ apiKey: process.env.EIGENPAL_API_KEY });
```

The `apiKey` constructor option always wins. If you omit it, the SDK falls back to `process.env.EIGENPAL_API_KEY` for convenience, handy in scripts where you'd be writing exactly the line above.

## Self-hosted

Point the SDK at your own deployment via `baseUrl`:

```ts
const client = new Eigenpal({
  apiKey: process.env.EIGENPAL_API_KEY,
  baseUrl: process.env.EIGENPAL_BASE_URL ?? 'https://eigenpal.acme.internal',
});
```

`baseUrl` likewise wins over the `EIGENPAL_BASE_URL` env fallback. Defaults to `https://app.eigenpal.com` (the hosted cloud).

## Triggering workflows

`workflows.run(workflowId, input?, options?)` enqueues a workflow execution.

```ts
// Async: returns immediately with { executionId }.
const { executionId } = await client.workflows.run('extract-invoice', {
  contract_document: file,
});

// Sync: server holds the connection up to 60 seconds.
const result = await client.workflows.run(
  'extract-invoice',
  { contract_document: file },
  { waitForCompletion: 60 }
);
console.log(result.status, result.result);

// Long-running: client-side polling, default 5min cap.
const final = await client.executions.runAndWait('extract-invoice', {
  contract_document: file,
});
```

The second argument is the workflow input map keyed by input name (as declared in the workflow). Pass `undefined` for inputs-less workflows. `options` carries `version`, `waitForCompletion`, and `overrides`.

## File inputs

When a workflow input is a file, pass a `File`, `Blob`, or explicit `{ content, filename, mimeType }` descriptor. The SDK auto-detects them and uploads the request as `multipart/form-data` (the same shape as `curl -F`, no base64 round-trip):

```ts
// Browser: File from <input type="file">
await client.workflows.run('extract-invoice', { contract_document: file });

// Node: Buffer from fs
import { readFile } from 'node:fs/promises';
const buffer = await readFile('contract.pdf');
await client.workflows.run('extract-invoice', {
  contract_document: {
    content: buffer,
    filename: 'contract.pdf',
    mimeType: 'application/pdf',
  },
});
```

> **Don't** base64-encode files yourself. The SDK is multipart-first; base64 doubles the payload size and skips the optimised upload path.

## Execution polling

```ts
const status = await client.executions.get(executionId);
//   { executionId, status, result?, error?, createdAt, completedAt? }

const list = await client.executions.list({
  workflowId: 'extract-invoice',
  status: 'failed',
  fromDate: 'now()-7d',
  limit: 50,
});

await client.executions.cancel(executionId);
```

## Workflows

```ts
await client.workflows.list({ search: 'invoice', limit: 20 });
await client.workflows.get('extract-invoice');
await client.workflows.versions('extract-invoice');
```

## Errors

Every non-2xx response throws a typed subclass of `EigenpalError`:

| HTTP            | Class                     | Notes                                                |
| --------------- | ------------------------- | ---------------------------------------------------- |
| 400             | `EigenpalValidationError` | `.issues` carries the per-field problems             |
| 401             | `EigenpalAuthError`       | Bad / missing API key                                |
| 403             | `EigenpalForbiddenError`  | API trigger disabled, scope mismatch                 |
| 404             | `EigenpalNotFoundError`   | Workflow / execution doesn't exist                   |
| 429             | `EigenpalRateLimitError`  | `.retryAfter` is the server-suggested wait (seconds) |
| 5xx             | `EigenpalServerError`     | Auto-retried up to `maxRetries`                      |
| timeout / abort | `EigenpalTimeoutError`    |                                                      |

```ts
import { Eigenpal, EigenpalValidationError } from '@eigenpal/sdk';

try {
  await client.workflows.run('extract-invoice');
} catch (err) {
  if (err instanceof EigenpalValidationError) {
    for (const issue of err.issues) {
      console.error(`${issue.field}: ${issue.message}`);
    }
  }
  throw err;
}
```

## Configuration

```ts
new Eigenpal({
  apiKey: 'eg_…', // or EIGENPAL_API_KEY
  baseUrl: 'https://app.eigenpal.com', // or EIGENPAL_BASE_URL
  timeoutMs: 60_000, // per-request timeout
  maxRetries: 3, // 5xx / 429 / network
  defaultHeaders: {
    // merged into every request
    'X-Trace-Id': '…',
  },
});
```

The SDK retries on 5xx, 429 (honoring `Retry-After`), and network errors. 4xx errors are surfaced immediately as typed exceptions and are not retried.

## TypeScript

The full request/response types are exported:

```ts
import type {
  WorkflowSummary,
  ExecutionStatusResponse,
  ListWorkflowsResponse,
} from '@eigenpal/sdk';
```

## License

Apache-2.0.
