# Evaluation

Use evaluation APIs when you want to manage datasets, run examples, start
experiments, and inspect evaluator scores from TypeScript.

## Dataset examples

```ts
const examples = await client.automations.examples.list('workflows.extract-invoice');

const example = await client.automations.examples.create('workflows.extract-invoice', {
  name: 'acme-invoice',
  input: { language: 'en' },
  expected: { vendor: 'Acme' },
});
```

Examples contain input, expected JSON output, expected files, metadata, and
optional overrides. For file-heavy datasets, prefer archive import/export so the
folder layout stays portable.

Dataset archives use the canonical `examples/<name>/input.json` layout with
file references such as `{ "$file": "input/contract.pdf" }`. Legacy archives
with `manifest.json`, `input/arguments.json`, `expected/output.json`, or
`expected/error.json` are rejected; export a fresh ZIP before re-importing.

## Experiments

```ts
const experiment = await client.automations.experiments.create('workflows.extract-invoice', {
  examples: [example.id],
});

const detail = await client.automations.experiments.get('workflows.extract-invoice', experiment.id);
```

An experiment runs dataset examples and records automated evaluator scores.
Older CLI docs may call the same id a `batchId`; API and SDK methods call it an
`experimentId`.

## Scores vs reviews

Evaluator `score` values are automated results. Run review `verdict` values are
human review decisions (`correct`, `incorrect`, or Nit). Use run review endpoints
when humans correct or promote a real run into the dataset. See
[Reviews](/concepts/reviews) for the review model.
