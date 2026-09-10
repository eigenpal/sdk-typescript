# Automations

`client.automations` is the public entry point for both workflows and agents. Start runs with root `client.run()`.

## List

```ts
const { data } = await client.automations.list({
  limit: 20,
  search: 'invoice',
  folderId: 'fldr_…',
});
for (const automation of data) {
  console.log(automation.id, automation.type, automation.folderPath);
}
```

`folderId: 'null'` lists unfiled YAML workflows at the tenant root. Combining `folderId` with `type: 'agent'` is rejected. Agent automations always return `folderId` / `folderPath` as `null`.

## Get

```ts
const automation = await client.automations.get('workflows.extract-invoice');
// { id, type, name, inputSchema, outputSchema, triggers, ... }
```

Use typed ids or aliases (`workflows.<slug>` / `agents.<slug>`) when a slug could exist in both systems.

## Move

Move YAML workflows between organizing folders. `folderPath` creates missing workflow folders; empty or `/` (and `folderId: null`) files the workflow at root. Agent automations have no database folder model and are rejected.

```ts
await client.automations.move('workflows.extract-invoice', { folderPath: 'billing/invoices' });
await client.automations.move('workflows.extract-invoice', { folderId: null });
```

## Delete

Delete uses the same cleanup as the dashboard. Workflows archive the automations registry parent and keep execution history. Agents delete the agent implementation and history, archive the registry parent, and best-effort-delete leftover agent storage. There is no uniform purge of every related artifact.

```ts
await client.automations.delete('workflows.extract-invoice');
await client.automations.delete('agents.invoice-agent');
```

## Folders

`client.folders` manages workflow and template trees. Deleting a folder cascade-deletes child folders and unfiles contained workflows or templates; it does not delete those resources. Nested agent directories in Git are source organization only and are not folders.

```ts
const tree = await client.folders.list({ type: 'workflow', tree: 'true' });
const folder = await client.folders.create({ name: 'invoices', type: 'workflow' });
await client.folders.update(folder.id, { parentId: null });
await client.folders.delete(folder.id);
```

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
