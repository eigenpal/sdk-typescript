# Workflows

`client.workflows` is the entry point for listing and fetching workflows. Start workflow runs with root `client.run()`.

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
const { runId } = await client.run('workflows.extract-invoice', {
  contract_document: file,
});
```

For webhooks and fire-and-forget jobs. Poll status via [`client.runs.get`](./executions.md).

### Sync (server holds up to 60s)

```ts
const result = await client.run(
  'workflows.extract-invoice',
  { contract_document: file },
  { waitForCompletion: 60 }
);
console.log(result.status, result.output);
```

If the run completes within `waitForCompletion` seconds, `status`/`output` are populated. Otherwise the response includes `runId`.

### Long-running (client polls)

```ts
const final = await client.workflows.executions.runAndWait('extract-invoice', {
  contract_document: file,
});
```

Default 5 min cap; tune with `pollIntervalMs` and `timeoutMs`. See [Executions](./executions.md#run-and-wait).

## Pin a version

```ts
await client.run('workflows.extract-invoice@1.2.3', input);
```

If omitted, the run picks up the workflow's current published version at trigger time.

## Override step output

```ts
await client.run('workflows.extract-invoice', input, {
  overrides: { steps: { 'parse-contract': { text: 'pre-extracted...' } } },
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
