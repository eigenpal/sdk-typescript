# Workflows

`client.workflows` is the entry point for listing, fetching, and running workflows.

## List

```ts
const { data } = await client.workflows.list({ limit: 20, search: 'invoice' });
for (const wf of data) console.log(wf.id, wf.version);
```

Query options: `limit`, `offset`, `search` (substring), `name` (exact slug), `kind` (`'workflow' | 'block'`).

## Get

```ts
const wf = await client.workflows.get('extract-invoice');
//   { id, version, createdAt, updatedAt }
```

`version` is the current published release tag (e.g. `"1.2.4"`), or `null` if no version is published yet.

## Trigger a run

Three ways to run, depending on how long you want to wait.

### Async (returns immediately)

```ts
const { executionId } = await client.workflows.run('extract-invoice', {
  contract_document: file,
});
```

For webhooks and fire-and-forget jobs. Poll status via [`client.workflows.executions.get`](./executions.md).

### Sync (server holds up to 60s)

```ts
const result = await client.workflows.run(
  'extract-invoice',
  { contract_document: file },
  { waitForCompletion: 60 }
);
console.log(result.status, result.result);
```

If the run completes within `waitForCompletion` seconds, `status`/`result` are populated. Otherwise just `executionId`.

### Long-running (client polls)

```ts
const final = await client.workflows.executions.runAndWait('extract-invoice', {
  contract_document: file,
});
```

Default 5 min cap; tune with `pollIntervalMs` and `timeoutMs`. See [Executions](./executions.md#run-and-wait).

## Pin a version

```ts
await client.workflows.run('extract-invoice', input, { version: '1.2.3' });
```

If omitted, the run picks up the workflow's current published version at trigger time.

## Override step output

```ts
await client.workflows.run('extract-invoice', input, {
  overrides: { 'parse-contract': { text: 'pre-extracted...' } },
});
```

Replaces a step's output for this one run. The step doesn't execute. Useful for testing downstream steps without re-running expensive parsing.

## List versions

```ts
const { data } = await client.workflows.versions('extract-invoice', { limit: 10 });
for (const v of data) console.log(v.id, v.version, v.isCurrent);
```

Returns published versions in reverse-chronological order.

## File inputs

See [File inputs](./files.md). The TL;DR: pass a `File`, `Blob`, or `{ content, filename, mimeType }` and the SDK uploads via `multipart/form-data` automatically.
