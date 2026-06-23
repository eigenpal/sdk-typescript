# Runs

`client.runs` is the shared run API for workflow, agent, manual, and eval runs.

## Start

```ts
const { id } = await client.run('workflows.extract-invoice', input);
```

For short jobs, ask the server to hold the request:

```ts
const result = await client.run('workflows.extract-invoice', input, {
  waitForCompletion: 60,
});
```

For longer jobs, poll manually:

```ts
const { id } = await client.run('agents.invoice-agent', input);
let run;
do {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  run = await client.runs.get(id);
} while (!run.finished);
```

## Get

```ts
const run = await client.runs.get(id);
// { id, type, finished, execution, output?, files?, error?, timing, ... }
```

Add heavier optional sections with `expand`:

```ts
const run = await client.runs.get(id, { expand: ['usage', 'execution'] });
console.log(run.output, run.usage, run.execution);
```

## List

```ts
const { runs } = await client.runs.list({
  type: 'workflow',
  status: 'failed,cancelled',
  limit: 50,
});
```

## Subresources

```ts
await client.runs.usage(id);
await client.runs.steps(id);
await client.runs.events(id);
await client.runs.trace.get(id);
await client.runs.reviews.get(id);
await client.runs.reviews.update(id, {
  note: 'Looks wrong',
  verdict: 'incorrect',
  status: 'open',
});
```

## Artifacts

```ts
const { artifacts } = await client.runs.artifacts.list(id);
const bytes = await client.runs.artifacts.download(id, artifacts[0].path);
```

Artifacts are run-scoped snapshots. Reusable uploaded files are managed separately through `client.files`.

## Cancel And Rerun

```ts
await client.runs.cancel(id);
const rerun = await client.rerun(id, { waitForCompletion: 60 });
```

## Promote

Copy a completed run's input, output, review, and corrected artifacts into a dataset example on the same automation:

```ts
const { exampleId, name } = await client.runs.promote(id, { name: 'golden-invoice' });
```
