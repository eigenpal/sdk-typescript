# Executions

`client.workflows.executions` inspects and manages individual workflow executions.

## Which polling option do I pick?

| Run length   | Use                                                                                   |
| ------------ | ------------------------------------------------------------------------------------- |
| 0–60s        | `client.workflows.run(id, input, { waitForCompletion: 60 })` — server hold.           |
| 60s–5min     | `client.workflows.executions.runAndWait(id, input)` — client polls every 2s.          |
| Driving a UI | `client.workflows.run(...)` then poll `client.workflows.executions.get(id)` yourself. |

## Statuses

```
created → pending → running → waiting → finalizing → completed
                                                     ↘ failed
                                                     ↘ cancelled
                                                     ↘ rejected
```

The first five are non-terminal; the last four are terminal. Always check `status` before reading `result`.

## Get

```ts
const exec = await client.workflows.executions.get(executionId);
//   { executionId, status, createdAt, completedAt?, result?, error? }
```

`result` is set on `status === 'completed'`. `error` is set on `status === 'failed'`.

### Per-step detail

```ts
const detail = await client.workflows.executions.get(executionId, { includeSteps: true });
```

Returns the full per-step execution payload (heavier; intended for debugging, not happy-path UI).

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

Triggers async, then polls `workflows.executions.get` until terminal or timeout. Throws `EigenpalTimeoutError` on timeout.

## List

```ts
const { data } = await client.workflows.executions.list('wf_abc123', {
  status: ['failed', 'cancelled'], // string or string[]
  fromDate: 'now()-7d', // ISO-8601 or relative expression
  toDate: 'now()',
  limit: 50,
});
```

Item shape: `{ id, workflowId, status, triggerType, triggerInput, result, error, createdAt, startedAt, completedAt, workflow }`.

`workflow` is `{ id, name }` of the owning workflow, or `null` if it has been deleted.

## Cancel

```ts
await client.workflows.executions.cancel(executionId);
```

Idempotent. For runs not yet picked up by a worker (`created`/`pending`), transitions immediately to `cancelled`. For `running` executions, stamps `cancelRequestedAt` so the worker honors the cancel at the next checkpoint.

## Polling pattern

If `runAndWait` doesn't fit (e.g. you're driving a UI progress bar), poll manually:

```ts
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'rejected']);

const { executionId } = await client.workflows.run('extract-invoice', input);
let status;
do {
  await new Promise((r) => setTimeout(r, 2000));
  status = await client.workflows.executions.get(executionId);
} while (!TERMINAL.has(status.status));

console.log(status.status, status.result, status.error);
```
