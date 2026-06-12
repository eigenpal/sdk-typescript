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

Get an API key at **studio.eigenpal.com → Settings → API Keys**.

## Quick start

```ts
import { EigenpalClient, EigenpalValidationError } from '@eigenpal/sdk';

const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY });

// Pass a File / Blob / { content, filename, mimeType }. The SDK uploads
// the request as multipart/form-data, no base64 needed.
const result = await client.workflows.executions.runAndWait('extract-invoice', {
  contract_document: file,
});
console.log(result.finished, result.output);
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

`baseUrl` likewise wins over the `EIGENPAL_BASE_URL` env fallback. Defaults to `https://studio.eigenpal.com` (the hosted cloud).

## Starting runs

`client.run(target, input?, options?)` starts a workflow or agent run. Targets can be strings such as `workflows.extract-invoice` / `agents.invoice-agent` or structured objects like `{ type: 'workflow', slug: 'extract-invoice' }`.

```ts
// Async: returns immediately with { id }.
const { id: runId } = await client.run('workflows.extract-invoice', {
  contract_document: file,
});

// Sync: server holds the connection up to 60 seconds.
const result = await client.run(
  { type: 'workflow', slug: 'extract-invoice', version: 'latest' },
  { contract_document: file },
  { waitForCompletion: 60 }
);
console.log(result.finished, result.output);

// Long-running: client-side polling, default 5min cap.
const final = await client.workflows.executions.runAndWait('extract-invoice', {
  contract_document: file,
});
```

The second argument is the input map keyed by input name. Pass `undefined` for inputs-less runs. `options` carries `waitForCompletion` and workflow `overrides`; put the workflow version or agent source ref in the target.

## File inputs

When a workflow input is a file, pass a `File`, `Blob`, or explicit `{ content, filename, mimeType }` descriptor. The SDK auto-detects them and uploads the request as `multipart/form-data` (the same shape as `curl -F`, no base64 round-trip):

```ts
// Browser: File from <input type="file">
await client.run('workflows.extract-invoice', { contract_document: file });

// Node: Buffer from fs
import { readFile } from 'node:fs/promises';
const buffer = await readFile('contract.pdf');
await client.run('workflows.extract-invoice', {
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
const runs = await client.runs.list({
  type: 'workflow',
  source: 'extract-invoice',
  status: 'failed,cancelled',
});

const run = await client.runs.get(runId);
//   { id, type, finished, output, files, error, timing, ... }

// Add heavier optional sections with `expand`.
const withUsage = await client.runs.get(runId, { expand: ['usage', 'execution'] });
console.log(
  withUsage.output,
  withUsage.files,
  withUsage.error,
  withUsage.usage,
  withUsage.execution
);

const list = await client.runs.list({
  type: 'workflow',
  source: 'extract-invoice',
  status: ['failed', 'cancelled'],
  from: 'now()-7d',
  limit: 50,
});

await client.runs.cancel(runId);
```

`/api/v1/runs` is the shared run API for workflow, agent, and eval runs. Use `type=workflow|agent`
and `source=<workflowId-or-agentId>` to scope list calls.

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

const { id: agentRunId } = await client.run('agents.invoice-agent', {
  invoice: file,
});

await client.runs.get(agentRunId);
await client.runs.cancel(agentRunId);
```

Agent run listing uses the same shared runs API with `type: 'agent'` and the agent id or slug as
`source`.

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
  console.log(result.finished, result.output);
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
