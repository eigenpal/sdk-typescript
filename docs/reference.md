# @eigenpal/sdk reference

## Quick example

```ts
import { EigenpalClient } from '@eigenpal/sdk';

const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY });

// Run a workflow with a file input (multipart upload, no base64).
const result = await client.workflows.executions.runAndWait('extract-invoice', {
  contract: file, // File / Blob / { content, filename, mimeType }
});

console.log(result.finished, result.output);
```

## Surface

```
client
├── run
├── rerun
├── agents
│   ├── list
│   ├── get
│   ├── create
│   ├── update
│   ├── listFiles
│   ├── putFile
│   ├── uploadFiles
│   ├── versions
│   └── emailTriggers
│       ├── list
│       ├── get
│       ├── createAlias
│       ├── deleteAlias
│       ├── update
│       └── updateAlias
├── workflows
│   ├── list
│   ├── get
│   ├── versions
│   └── executions
│       └── runAndWait
├── runs
│   ├── list
│   ├── get
│   ├── artifacts
│   │   ├── list
│   │   ├── download
│   │   └── downloadZip
│   ├── cancel
│   ├── compare
│   ├── comparison
│   │   └── get
│   ├── connect
│   ├── definition
│   ├── expected
│   │   ├── list
│   │   ├── copyOutput
│   │   ├── delete
│   │   ├── download
│   │   ├── rename
│   │   └── upload
│   ├── feedback
│   │   ├── get
│   │   ├── clear
│   │   ├── resolve
│   │   └── update
│   ├── files
│   │   ├── list
│   │   ├── delete
│   │   └── upload
│   └── trace
│       └── get
├── source
│   ├── decryptSecrets
│   ├── encryptSecrets
│   ├── lockfile
│   ├── raw
│   ├── releases
│   └── repository
└── automations
    └── sync
```

Start runs with `client.run(...)` and create a new run from a previous snapshot with `client.rerun(...)`.

Run inspection and artifact/feedback/file mutation lives under `client.runs.*`, which maps to `/api/v1/runs`.

`client.runs.artifacts.*` lists and downloads artifacts for both workflow and agent runs. Output artifacts live under `output/`; workflow outputs may include `stepName`, and agent diagnostics use root paths such as `trace.jsonl`, `issues.md`, and `eigenpal.lock`. `client.runs.files.*` remains the DB-backed workflow file surface for input management and structured file listings.

`client.workflows.executions.runAndWait` remains a workflow-specific helper because it triggers a workflow and then polls the canonical runs API until completion.

## Client construction

```ts
import { EigenpalClient } from '@eigenpal/sdk';

const client = new EigenpalClient({
  apiKey: process.env.EIGENPAL_API_KEY,
  // For self-hosted deployments:
  baseUrl: process.env.EIGENPAL_BASE_URL,
});
```

The constructor option always wins; the env var is a fallback so scripts don't have to write `{ apiKey: process.env.EIGENPAL_API_KEY }` explicitly.

| Option           | Type                     | Default                                                            | Description                                       |
| ---------------- | ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------- |
| `apiKey`         | `string`                 | `process.env.EIGENPAL_API_KEY`                                     | Bearer key from the dashboard.                    |
| `baseUrl`        | `string`                 | `process.env.EIGENPAL_BASE_URL` ?? `'https://studio.eigenpal.com'` | API host. Set to your deployment for self-hosted. |
| `timeoutMs`      | `number`                 | `60_000`                                                           | Per-request timeout.                              |
| `maxRetries`     | `number`                 | `3`                                                                | Retries on 5xx / 429 / network errors.            |
| `fetch`          | `typeof fetch`           | global                                                             | Custom fetch (for tests / proxies).               |
| `defaultHeaders` | `Record<string, string>` | `{}`                                                               | Extra headers attached to every request.          |

## Agents

### `client.agents.listFiles`

**`GET /api/v1/agents/:agentId/files`**

List or download agent source files

List or read agent source files from Git.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Query parameters**

| Name     | Type     | Description                      |
| -------- | -------- | -------------------------------- |
| `path`   | `string` | (optional)                       |
| `prefix` | `string` | (optional)                       |
| `ref`    | `string` | (optional)Git ref (default main) |

**Response**

```ts
// unknown
```

### `client.agents.putFile`

**`PUT /api/v1/agents/:agentId/files`**

Upload one agent file (deprecated)

Agent source is Git-backed. Use Git push or the builder instead.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Query parameters**

| Name     | Type     | Description                      |
| -------- | -------- | -------------------------------- |
| `path`   | `string` | (optional)                       |
| `prefix` | `string` | (optional)                       |
| `ref`    | `string` | (optional)Git ref (default main) |

**Request body**

```ts
// Record<string, unknown>
```

### `client.agents.uploadFiles`

**`POST /api/v1/agents/:agentId/files`**

Upload agent files (deprecated)

Agent source is Git-backed. Use Git push or the builder instead.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Request body**

```ts
// Record<string, unknown>
```

### `client.agents.get`

**`GET /api/v1/agents/:agentId`**

Get an agent

Returns one agent by id or slug.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Query parameters**

| Name      | Type     | Description                                                     |
| --------- | -------- | --------------------------------------------------------------- |
| `include` | `string` | (optional)Comma-separated optional sections, e.g. files,dataset |

**Response**

```ts
// GetAgentResponse
```

### `client.agents.update`

**`PATCH /api/v1/agents/:agentId`**

Update an agent

Updates mutable agent metadata and configuration.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Request body**

```ts
// PatchAgentBody
```

**Response**

```ts
// PatchAgentResponse
```

### `client.agents.emailTriggers.updateAlias`

**`PATCH /api/v1/agents/:agentId/triggers/email/:emailId`**

Update an agent email alias

Updates an email trigger alias for one agent.

**Path parameters**

| Name      | Type     | Description            |
| --------- | -------- | ---------------------- |
| `agentId` | `string` | Agent id or slug       |
| `emailId` | `string` | Email trigger alias id |

**Request body**

```ts
// Record<string, unknown>
```

**Response**

```ts
// Record<string, unknown>
```

### `client.agents.emailTriggers.deleteAlias`

**`DELETE /api/v1/agents/:agentId/triggers/email/:emailId`**

Delete an agent email alias

Revokes an email trigger alias for one agent.

**Path parameters**

| Name      | Type     | Description            |
| --------- | -------- | ---------------------- |
| `agentId` | `string` | Agent id or slug       |
| `emailId` | `string` | Email trigger alias id |

**Response**

```ts
// Record<string, unknown>
```

### `client.agents.emailTriggers.get`

**`GET /api/v1/agents/:agentId/triggers/email`**

Get an agent email trigger

Returns email trigger configuration and aliases for one agent.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Response**

```ts
// Record<string, unknown>
```

### `client.agents.emailTriggers.update`

**`PATCH /api/v1/agents/:agentId/triggers/email`**

Update an agent email trigger

Enables or disables the email trigger for one agent.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Request body**

```ts
// Record<string, unknown>
```

**Response**

```ts
// Record<string, unknown>
```

### `client.agents.emailTriggers.createAlias`

**`POST /api/v1/agents/:agentId/triggers/email`**

Create an agent email alias

Creates an email trigger alias for one agent.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Request body**

```ts
// Record<string, unknown>
```

**Response**

```ts
// Record<string, unknown>
```

### `client.agents.versions`

**`GET /api/v1/agents/:agentId/versions`**

List agent Git versions

List Git release versions for an agent.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Response**

```ts
// ListAgentVersionsResponse
```

### `client.agents.list`

**`GET /api/v1/agents`**

List agents

List agents with pagination.

**Query parameters**

| Name              | Type      | Description                                    |
| ----------------- | --------- | ---------------------------------------------- |
| `search`          | `string`  | (optional)Substring match against agent fields |
| `slug`            | `string`  | (optional)Return a single agent by slug        |
| `limit`           | `number`  | (optional)                                     |
| `offset`          | `number`  | (optional)                                     |
| `includeArchived` | `boolean` | (optional)                                     |

**Response**

```ts
// ListAgentsResponse
```

### `client.agents.create`

**`POST /api/v1/agents`**

Create an agent

Create an agent and scaffold its Git source package.

**Request body**

```ts
// CreateAgentBody
```

**Response**

```ts
// CreateAgentResponse
```

### `client.agents.emailTriggers.list`

**`GET /api/v1/agents/triggers/email`**

List agent email triggers

Lists email trigger aliases for the authenticated organization.

**Response**

```ts
// Record<string, unknown>
```

## Automations

### `client.automations.sync`

**`POST /api/v1/automations/:automation/sync`**

Sync an automation from latest source

Reconciles lightweight automation metadata from the latest released Git source package. This does not enqueue executions.

**Path parameters**

| Name         | Type     | Description |
| ------------ | -------- | ----------- |
| `automation` | `string` |             |

**Response**

```ts
// AutomationSyncResponse
```

## Runs

### `client.run`

**`POST /api/v1/runs`**

Start a run

Start a run. Send JSON or multipart/form-data.

**Query parameters**

| Name                  | Type     | Description                                                           |
| --------------------- | -------- | --------------------------------------------------------------------- |
| `version`             | `string` | (optional)Release or git ref. Defaults to latest.                     |
| `wait_for_completion` | `number` | (optional)Seconds to wait before returning (max 600). Omit for async. |

**Request body**

```ts
// RunStartBody
```

**Response**

```ts
// RunStartResponse
```

### `client.runs.list`

**`GET /api/v1/runs`**

List runs

List workflow and agent runs with cursor pagination.

**Query parameters**

| Name                | Type     | Description |
| ------------------- | -------- | ----------- |
| `type`              | `string` | (optional)  |
| `source`            | `string` | (optional)  |
| `status`            | `string` | (optional)  |
| `trigger`           | `string` | (optional)  |
| `triggeredBy`       | `string` | (optional)  |
| `sourceRef`         | `string` | (optional)  |
| `batchId`           | `string` | (optional)  |
| `exampleId`         | `string` | (optional)  |
| `exampleIdContains` | `string` | (optional)  |
| `from`              | `string` | (optional)  |
| `to`                | `string` | (optional)  |
| `createdAfter`      | `string` | (optional)  |
| `createdBefore`     | `string` | (optional)  |
| `completedAfter`    | `string` | (optional)  |
| `completedBefore`   | `string` | (optional)  |
| `cursor`            | `string` | (optional)  |
| `offset`            | `number` | (optional)  |
| `limit`             | `number` | (optional)  |
| `ids`               | `string` | (optional)  |

**Response**

```ts
// RunsListResponse
```

### `client.runs.artifacts.download`

**`GET /api/v1/runs/:id/artifacts/:path`**

Download run artifact

Download one artifact by path.

**Path parameters**

| Name   | Type     | Description |
| ------ | -------- | ----------- |
| `id`   | `string` |             |
| `path` | `string` |             |

### `client.runs.artifacts.list`

**`GET /api/v1/runs/:id/artifacts`**

List run artifacts

List downloadable artifact paths for a run.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id      |

**Response**

```ts
// RunArtifactsResponse
```

### `client.runs.cancel`

**`POST /api/v1/runs/:id/cancel`**

Cancel run

Cancel a queued run or request cancellation of an in-flight run.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// RunCancelResponse
```

### `client.runs.comparison.get`

**`GET /api/v1/runs/:id/comparison`**

Get run comparison

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.connect`

**`POST /api/v1/runs/:id/connect`**

Connect to live run

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.definition`

**`GET /api/v1/runs/:id/definition`**

Get run definition snapshot

Workflow definition snapshot captured when the run was created.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id      |

**Response**

```ts
// RunDefinitionResponse
```

### `client.runs.expected.download`

**`GET /api/v1/runs/:id/expected/:filename`**

Download expected artifact file

**Path parameters**

| Name       | Type     | Description |
| ---------- | -------- | ----------- |
| `id`       | `string` |             |
| `filename` | `string` |             |

### `client.runs.expected.rename`

**`PATCH /api/v1/runs/:id/expected/:filename`**

Rename expected artifact file

**Path parameters**

| Name       | Type     | Description |
| ---------- | -------- | ----------- |
| `id`       | `string` |             |
| `filename` | `string` |             |

**Request body**

```ts
// Record<string, unknown>
```

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.expected.delete`

**`DELETE /api/v1/runs/:id/expected/:filename`**

Delete expected artifact file

**Path parameters**

| Name       | Type     | Description |
| ---------- | -------- | ----------- |
| `id`       | `string` |             |
| `filename` | `string` |             |

### `client.runs.expected.list`

**`GET /api/v1/runs/:id/expected`**

Get run expected artifacts

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.expected.copyOutput`

**`POST /api/v1/runs/:id/expected`**

Create or update expected artifacts

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Request body**

```ts
// Record<string, unknown>
```

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.feedback.get`

**`GET /api/v1/runs/:id/feedback`**

Get run feedback

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.feedback.update`

**`PATCH /api/v1/runs/:id/feedback`**

Update run feedback

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Request body**

```ts
// RunFeedbackRequest
```

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.feedback.clear`

**`DELETE /api/v1/runs/:id/feedback`**

Clear run feedback

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.artifacts.downloadZip`

**`GET /api/v1/runs/:id/files-zip`**

Download run output files zip

Download agent run output files as a zip.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Query parameters**

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `files` | `string` | (optional)  |
| `token` | `string` | (optional)  |

### `client.runs.files.delete`

**`DELETE /api/v1/runs/:id/files/:fileId`**

Delete run input file

**Path parameters**

| Name     | Type     | Description |
| -------- | -------- | ----------- |
| `id`     | `string` |             |
| `fileId` | `string` |             |

### `client.runs.files.list`

**`GET /api/v1/runs/:id/files`**

List run files

List workflow run input and output file rows.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// RunFilesResponse
```

### `client.runs.files.upload`

**`POST /api/v1/runs/:id/files`**

Upload run input file

Upload a workflow run input file before execution starts.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.rerun`

**`POST /api/v1/runs/:id/rerun`**

Rerun run

Start a new run from an existing run id.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Query parameters**

| Name                  | Type     | Description                                                                            |
| --------------------- | -------- | -------------------------------------------------------------------------------------- |
| `version`             | `string` | (optional)Version for the new run. `original` pins the source run. Defaults to latest. |
| `wait_for_completion` | `number` | (optional)Seconds to wait before returning (max 600). Omit for async.                  |

**Response**

```ts
// RunRerunResponse
```

### `client.runs.get`

**`GET /api/v1/runs/:id`**

Get run

Fetch one run by id. Use `expand` for input, usage, execution, and debug detail.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id      |

**Query parameters**

| Name     | Type     | Description                                                                                                                           |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `expand` | `string` | (optional)Optional sections: `input`, `usage`, `execution`, `debug`. Terminal runs always include top-level output, files, and error. |

**Response**

```ts
// Run
```

### `client.runs.trace.get`

**`GET /api/v1/runs/:id/trace`**

Get run trace

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

## Source

### `client.source.lockfile`

**`GET /api/v1/source/lockfile`**

Preview a source lockfile

Resolves a package ref and returns the would-be eigenpal.lock without enqueueing or writing runtime artifacts.

**Query parameters**

| Name         | Type     | Description |
| ------------ | -------- | ----------- |
| `packageRef` | `string` |             |

**Response**

```ts
// SourceLockfileResponse
```

### `client.source.raw`

**`GET /api/v1/source/raw`**

Preview a raw Git source file

Reads a raw file from the organization Git repository for metadata previews.

**Query parameters**

| Name   | Type     | Description |
| ------ | -------- | ----------- |
| `ref`  | `string` | (optional)  |
| `path` | `string` |             |

**Response**

```ts
// RawSourceResponse
```

### `client.source.releases`

**`GET /api/v1/source/releases`**

List Git source package releases

Lists package-scoped Git release tags, or returns one exact version when requested.

**Query parameters**

| Name          | Type     | Description |
| ------------- | -------- | ----------- |
| `packagePath` | `string` |             |
| `version`     | `string` | (optional)  |

**Response**

```ts
// SourceReleasesResponse
```

### `client.source.repository`

**`GET /api/v1/source/repository`**

Get organization Git source repository

Returns the authenticated organization Git remote used by hidden source CLI commands.

**Response**

```ts
// SourceRepositoryResponse
```

### `client.source.decryptSecrets`

**`POST /api/v1/source/secrets/decrypt`**

Decrypt a Git-backed source secret

Decrypts one or more encrypted source secret values for the authenticated tenant. Single-secret requests require an execution id and are checked against that execution lockfile graph; batch `secrets[]` requests are tenant-scoped for local CLI use.

**Request body**

```ts
// SourceSecretsDecryptBody
```

**Response**

```ts
// SourceSecretsDecryptResponse
```

### `client.source.encryptSecrets`

**`POST /api/v1/source/secrets/encrypt`**

Encrypt a Git-backed source secret

Encrypts one or more plaintext secret values for the authenticated tenant using the organization active decrypt key. Organization decrypt keys never leave the server; callers send plaintext over TLS with normal app authentication.

**Request body**

```ts
// SourceSecretsEncryptBody
```

**Response**

```ts
// SourceSecretsEncryptResponse
```

## Workflows

### `client.workflows.get`

**`GET /api/v1/workflows/:id`**

Get a workflow by id

Get a workflow by id, including current YAML.

**Path parameters**

| Name | Type     | Description                  |
| ---- | -------- | ---------------------------- |
| `id` | `string` | Workflow id (e.g. wf_abc123) |

**Response**

```ts
// WorkflowDetail
```

### `client.workflows.versions`

**`GET /api/v1/workflows/:id/versions`**

List tagged versions for a workflow

List published workflow versions.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Workflow id |

**Query parameters**

| Name     | Type     | Description                               |
| -------- | -------- | ----------------------------------------- |
| `limit`  | `number` | (optional)Page size (max 100, default 50) |
| `offset` | `number` | (optional)Page offset                     |

**Response**

```ts
// ListVersionsResponse
```

### `client.workflows.list`

**`GET /api/v1/workflows`**

List workflows

List workflows with pagination.

**Query parameters**

| Name     | Type                    | Description                                          |
| -------- | ----------------------- | ---------------------------------------------------- |
| `search` | `string`                | (optional)Substring match against workflow name      |
| `name`   | `string`                | (optional)Exact-match lookup by workflow name (slug) |
| `kind`   | `"workflow" \| "block"` | (optional)Filter by workflow kind                    |
| `limit`  | `number`                | (optional)Page size (max 100, default 50)            |
| `offset` | `number`                | (optional)Page offset                                |

**Response**

```ts
// ListWorkflowsResponse
```

## Errors

Every non-2xx response throws a typed exception:

| HTTP    | TypeScript                | Python                    |
| ------- | ------------------------- | ------------------------- |
| 400     | `EigenpalValidationError` | `EigenpalValidationError` |
| 401     | `EigenpalAuthError`       | `EigenpalAuthError`       |
| 403     | `EigenpalForbiddenError`  | `EigenpalForbiddenError`  |
| 404     | `EigenpalNotFoundError`   | `EigenpalNotFoundError`   |
| 429     | `EigenpalRateLimitError`  | `EigenpalRateLimitError`  |
| 5xx     | `EigenpalServerError`     | `EigenpalServerError`     |
| timeout | `EigenpalTimeoutError`    | `EigenpalTimeoutError`    |

The thrown exception carries `status`, `requestId`, `envelope` (raw `ApiErrorEnvelope`), and (for 429) `retryAfter`.
