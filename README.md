# @eigenpal/sdk

Trigger EigenPal workflows from TypeScript.

[![npm](https://img.shields.io/npm/v/@eigenpal/sdk?color=3B5BDB&labelColor=555&label=npm)](https://www.npmjs.com/package/@eigenpal/sdk)
[![downloads](https://img.shields.io/npm/dm/@eigenpal/sdk?color=3B5BDB&labelColor=555&label=downloads)](https://www.npmjs.com/package/@eigenpal/sdk)
[![license](https://img.shields.io/badge/license-Apache--2.0-3B5BDB?labelColor=555)](https://github.com/eigenpal/sdk-typescript/blob/main/LICENSE)
[![docs](https://img.shields.io/badge/docs-eigenpal%2Fsdk-3B5BDB?labelColor=555)](https://github.com/eigenpal/sdk-typescript)

## Install

```bash
npm i @eigenpal/sdk
```

Requires a TypeScript-aware runtime: Bun, Deno, Node 22+ (native TS), `tsx`, Next.js, Vite, or any modern bundler. Plain `node script.js` won't work — see [Configuration](./docs/configuration.md#typescript-runtime).

Get an API key at **app.eigenpal.com → Settings → API Keys**.

## Quick start

```ts
import { EigenpalClient, EigenpalValidationError } from '@eigenpal/sdk';

const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY });

// Pass a File / Blob / { content, filename, mimeType }. The SDK uploads
// the request as multipart/form-data, no base64 needed.
const result = await client.workflows.executions.runAndWait('extract-invoice', {
  contract_document: file,
});
console.log(result.status, result.result);
```

## Authentication

Generate an API key from the dashboard under **Settings → API Keys**, then pass it explicitly:

```ts
const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY });
```

The `apiKey` constructor option always wins. If you omit it, the SDK falls back to `process.env.EIGENPAL_API_KEY` for convenience, handy in scripts where you'd be writing exactly the line above.

## Self-hosted

Point the SDK at your own deployment via `baseUrl`:

```ts
const client = new EigenpalClient({
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
const final = await client.workflows.executions.runAndWait('extract-invoice', {
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
const status = await client.workflows.executions.get(executionId);
//   { executionId, status, result?, error?, createdAt, completedAt? }

const list = await client.workflows.executions.list('extract-invoice', {
  status: ['failed', 'cancelled'],
  fromDate: 'now()-7d',
  limit: 50,
});

await client.workflows.executions.cancel(executionId);
```

## Workflows

```ts
await client.workflows.list({ search: 'invoice', limit: 20 });
await client.workflows.get('extract-invoice');
await client.workflows.versions('extract-invoice');
```

## Agents

```ts
await client.agents.list({ search: 'invoice' });
await client.agents.get('invoice-agent');

const { executionId } = await client.agents.run('invoice-agent', {
  invoice: file,
});

await client.agents.executions.get(executionId);
await client.agents.executions.cancel(executionId);
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
import { EigenpalClient, EigenpalValidationError } from '@eigenpal/sdk';

const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY });

try {
  // First arg accepts the workflow slug ('extract-invoice') or id ('wf_abc123').
  const result = await client.workflows.executions.runAndWait('extract-invoice', {
    language: 'en',
  });
  console.log(result.status, result.result);
} catch (err) {
  if (err instanceof EigenpalValidationError) {
    for (const issue of err.issues) console.error(`${issue.field}: ${issue.message}`);
  }
  throw err;
}
```

For file inputs, see [docs/files.md](./docs/files.md).

## Reference

| Topic                                     | What's in it                                       |
| ----------------------------------------- | -------------------------------------------------- |
| [Workflows](./docs/workflows.md)          | List, get, trigger runs, pin versions.             |
| [Executions](./docs/executions.md)        | Status, polling, cancel, run-and-wait.             |
| [File inputs](./docs/files.md)            | Multipart upload from File, Blob, Buffer, or path. |
| [Errors](./docs/errors.md)                | Typed exceptions, retries, request ids.            |
| [Configuration](./docs/configuration.md)  | API key, baseUrl, timeouts, headers.               |
| [Full API reference](./docs/reference.md) | Every method, generated from the OpenAPI spec.     |

## License

Apache-2.0.
