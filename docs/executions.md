# Executions

`client.workflows.executions` only exposes `runAndWait`. Inspect and manage existing workflow runs through `client.runs`.

## Which polling option do I pick?

| Run length   | Use                                                                               |
| ------------ | --------------------------------------------------------------------------------- |
| 0–60s        | `client.run("workflows.<slug>", input, { waitForCompletion: 60 })` — server hold. |
| 60s–5min     | `client.workflows.executions.runAndWait(id, input)` — client polls every 2s.      |
| Driving a UI | `client.run(...)` then poll `client.runs.get(id)` yourself.                       |

## Statuses

```
created → pending → running → waiting → finalizing → completed
                                                     ↘ failed
                                                     ↘ cancelled
                                                     ↘ rejected
```

The first five are non-terminal; the last four are terminal. Check `finished` (or `execution.status` with `expand`) before reading `output`/`files`/`error`.

## Get

```ts
const run = await client.runs.get(runId);
//   { id, type, finished, execution, output?, files?, error?, timing, ... }
```

Terminal runs expose `output`, `files`, and `error` at the top level. Completed runs include `output` and `files`; failed or cancelled runs include `error`.
Downloadable output files are listed in `files` on completed runs; pass each entry's `path` to
`client.runs.artifacts.download`.

### Expanding heavier fields

```ts
const run = await client.runs.get(runId, { expand: ['usage', 'execution'] });
console.log(run.output, run.usage, run.execution);
```

`expand` adds optional nested sections in-place onto the run object. Pass an array of valid tokens: `input`, `usage`, `execution`, and `debug`; `execution` adds the heavier workflow step details or agent artifact summary.

## Run and wait

The convenience helper that wraps trigger + poll:

```ts
const final = await client.workflows.executions.runAndWait(
  'extract-invoice',
  { contract_document: file },
  {
    pollIntervalMs: 2000, // default 2s
    timeoutMs: 5 * 60_000, // default 5min
  }
);
```

Triggers async, then polls `client.runs.get` until terminal or timeout. Throws `EigenpalTimeoutError` on timeout.

## List

```ts
const { runs } = await client.runs.list({
  type: 'workflow',
  source: 'wf_abc123',
  status: ['failed', 'cancelled'], // string or string[]
  from: 'now()-7d', // ISO-8601 or relative expression
  to: 'now()',
  limit: 50,
});
```

Item shape: `{ id, type, finished, timing, source, trigger, execution, error?, eval? }`.

`source` identifies the owning workflow or agent. List rows always include slim
`execution` but omit completed-only `output`/`files`; fetch the detail with
`client.runs.get(id)` when you need output artifacts.

## Cancel

```ts
await client.runs.cancel(runId);
```

Idempotent. For runs not yet picked up by a worker (`created`/`pending`), transitions immediately to `cancelled`. For `running` executions, stamps `cancelRequestedAt` so the worker honors the cancel at the next checkpoint.

## Polling pattern

If `runAndWait` doesn't fit (e.g. you're driving a UI progress bar), poll manually:

```ts
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'rejected']);

const { id } = await client.run('workflows.extract-invoice', input);
let run;
do {
  await new Promise((r) => setTimeout(r, 2000));
  run = await client.runs.get(id);
} while (!run.finished);

console.log(run.execution?.status, run.output, run.error);
```
