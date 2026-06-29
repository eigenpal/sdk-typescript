# @eigenpal/sdk

Trigger and inspect Eigenpal automations from TypeScript.

[![npm](https://img.shields.io/npm/v/@eigenpal/sdk?color=3B5BDB&labelColor=555&label=npm)](https://www.npmjs.com/package/@eigenpal/sdk)
[![downloads](https://img.shields.io/npm/dm/@eigenpal/sdk?color=3B5BDB&labelColor=555&label=downloads)](https://www.npmjs.com/package/@eigenpal/sdk)
[![license](https://img.shields.io/badge/license-Apache--2.0-3B5BDB?labelColor=555)](https://github.com/eigenpal/sdk-typescript/blob/main/LICENSE)

## Install

```bash
npm i @eigenpal/sdk
```

Requires a TypeScript-aware runtime: Bun, Deno, Node 22+ (native TS), `tsx`, Next.js, Vite, or any modern bundler. Plain `node script.js` will not work; see [Configuration](./docs/configuration.md#typescript-runtime).

Get an API key at **studio.eigenpal.com -> Settings -> API Keys**.

## Quick Start

```ts
import { EigenpalClient } from '@eigenpal/sdk';

const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY });

const result = await client.run(
  'workflows.extract-invoice',
  { contract_document: file },
  { waitForCompletion: 60 }
);

if (result.finished) {
  console.log(result.output);
}
```

`target` is always typed: `workflows.<slug>` or `agents.<slug>`. That keeps workflow and agent slugs unambiguous.

## Automations

Workflows and agents are exposed as automations.

```ts
const { data } = await client.automations.list({ search: 'invoice' });
const automation = await client.automations.get('workflows.extract-invoice');
const versions = await client.automations.versions('workflows.extract-invoice');
const triggers = await client.automations.triggers('workflows.extract-invoice');
```

## Runs

```ts
const { id } = await client.run('agents.invoice-agent', { invoice: file });

const run = await client.runs.get(id, { expand: ['usage', 'execution'] });
const usage = await client.runs.usage(id);
const steps = await client.runs.steps(id);
const events = await client.runs.events(id);
const trace = await client.runs.trace.get(id);

await client.runs.cancel(id);
await client.rerun(id, { waitForCompletion: 60 });
```

List calls use the same run API for workflows, agents, manual runs, and eval runs:

```ts
const recentFailures = await client.runs.list({
  type: 'workflow',
  status: 'failed,cancelled',
  limit: 50,
});
```

## Files And Artifacts

Use `client.files` for reusable upload-first blobs. When referenced by a run input, Eigenpal snapshots the file into run-scoped artifacts.

```ts
const uploaded = await client.files.upload(file);

const started = await client.run('workflows.extract-invoice', {
  contract_document: { $fileId: uploaded.id },
});

const artifacts = await client.runs.artifacts.list(started.id);
const pdf = await client.runs.artifacts.download(started.id, artifacts.artifacts[0].path);
```

You can also pass a `File`, `Blob`, or `{ content, filename, mimeType }` directly to `client.run`; the SDK sends multipart form data automatically. Durable run inputs and dataset examples store scoped `{ "$file": "input/..." }` artifact refs after ingestion.

## Errors

Every non-2xx response throws a typed subclass of `EigenpalError`:

| HTTP            | Class                     |
| --------------- | ------------------------- |
| 400             | `EigenpalValidationError` |
| 401             | `EigenpalAuthError`       |
| 403             | `EigenpalForbiddenError`  |
| 404             | `EigenpalNotFoundError`   |
| 429             | `EigenpalRateLimitError`  |
| 5xx             | `EigenpalServerError`     |
| timeout / abort | `EigenpalTimeoutError`    |

## Reference

| Topic                                     | What is in it                                                      |
| ----------------------------------------- | ------------------------------------------------------------------ |
| [Automations](./docs/workflows.md)        | List, inspect, versions, triggers.                                 |
| [Runs](./docs/executions.md)              | Start, poll, cancel, rerun, usage, steps, events, traces, reviews. |
| [File inputs](./docs/files.md)            | Multipart upload from File, Blob, Buffer, or path.                 |
| [Errors](./docs/errors.md)                | Typed exceptions, retries, request ids.                            |
| [Configuration](./docs/configuration.md)  | API key, baseUrl, timeouts, headers.                               |
| [Full API reference](./docs/reference.md) | Every method, generated from OpenAPI.                              |

## License

Apache-2.0.
