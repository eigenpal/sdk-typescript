# Automations

`client.automations` is the public entry point for both workflows and agents. Start runs with root `client.run()`.

## List

```ts
const { data } = await client.automations.list({ limit: 20, search: 'invoice' });
for (const automation of data) {
  console.log(automation.id, automation.type, automation.name);
}
```

## Get

```ts
const automation = await client.automations.get('workflows.extract-invoice');
// { id, type, name, inputSchema, outputSchema, triggers, ... }
```

Use typed ids or aliases (`workflows.<slug>` / `agents.<slug>`) when a slug could exist in both systems.

## Versions

```ts
const { data } = await client.automations.versions('workflows.extract-invoice');
for (const version of data) console.log(version.id, version.version, version.isCurrent);
```

## Triggers

```ts
const { triggers } = await client.automations.triggers('agents.invoice-agent');
for (const trigger of triggers) console.log(trigger.type, trigger.enabled);
```

Trigger mutation and source management are intentionally not part of the public SDK surface.

## Start A Run

```ts
const { id } = await client.run('workflows.extract-invoice', {
  contract_document: file,
});
```

Pin a version or agent source ref by suffixing the target:

```ts
await client.run('workflows.extract-invoice@1.2.3', input);
await client.run('agents.invoice-agent@main', input);
```

## File Inputs

See [File inputs](./files.md). Pass a `File`, `Blob`, or `{ content, filename, mimeType }` and the SDK uploads via `multipart/form-data` automatically.
