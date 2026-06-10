# @eigenpal/sdk reference

## Quick example

```ts
import { EigenpalClient } from '@eigenpal/sdk';

const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY });

// Run a workflow with a file input (multipart upload, no base64).
const result = await client.workflows.executions.runAndWait('extract-invoice', {
  contract: file, // File / Blob / { content, filename, mimeType }
});

console.log(result.status, result.output);
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
│   │   ├── download
│   │   └── downloadZip
│   ├── cancel
│   ├── compare
│   ├── comparison
│   │   └── get
│   ├── connect
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
│   ├── resume
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

`client.runs.files.*` is currently for DB-backed workflow run files. `client.runs.artifacts.*` is currently for agent run artifacts such as traces, metadata, and output files; workflow artifacts will be unified in a future refactor.

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

| Option           | Type                     | Default                                                         | Description                                       |
| ---------------- | ------------------------ | --------------------------------------------------------------- | ------------------------------------------------- |
| `apiKey`         | `string`                 | `process.env.EIGENPAL_API_KEY`                                  | Bearer key from the dashboard.                    |
| `baseUrl`        | `string`                 | `process.env.EIGENPAL_BASE_URL` ?? `'https://app.eigenpal.com'` | API host. Set to your deployment for self-hosted. |
| `timeoutMs`      | `number`                 | `60_000`                                                        | Per-request timeout.                              |
| `maxRetries`     | `number`                 | `3`                                                             | Retries on 5xx / 429 / network errors.            |
| `fetch`          | `typeof fetch`           | global                                                          | Custom fetch (for tests / proxies).               |
| `defaultHeaders` | `Record<string, string>` | `{}`                                                            | Extra headers attached to every request.          |

## Agents

### `client.agents.listFiles`

**`GET /api/v1/agents/{agentId}/files`**

List or download agent source files

Lists or reads files from the agent Git package (`agents/{slug}/` on organization source). Runtime artifacts (runs, dataset) are not served here.

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

**`PUT /api/v1/agents/{agentId}/files`**

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

**`POST /api/v1/agents/{agentId}/files`**

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

**`GET /api/v1/agents/{agentId}`**

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

**`PATCH /api/v1/agents/{agentId}`**

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

**`PATCH /api/v1/agents/{agentId}/triggers/email/{emailId}`**

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

**`DELETE /api/v1/agents/{agentId}/triggers/email/{emailId}`**

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

**`GET /api/v1/agents/{agentId}/triggers/email`**

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

**`PATCH /api/v1/agents/{agentId}/triggers/email`**

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

**`POST /api/v1/agents/{agentId}/triggers/email`**

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

**`GET /api/v1/agents/{agentId}/versions`**

List agent Git versions

Lists Git-backed release versions for an agent. Release notes are included when a matching legacy published-version message exists.

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

Returns agents the caller has access to, with pagination and basic execution stats. Accepts session cookies or API keys.

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

Creates a new agent, registers it in the automation table, and scaffolds its Git source package. Accepts session cookies or API keys.

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

**`POST /api/v1/automations/{automation}/sync`**

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

**`POST /api/v1/run/{target}`**

Start a workflow or agent run

Starts a run for a workflow or agent target. The target lives in the URL path; the optional `version` query parameter selects a release/ref and defaults to `latest`. The request body is the input object; a reserved `_overrides` key (workflow targets only) carries per-step output overrides for replay. Run provenance may be declared with the `X-Eigenpal-Trigger` header (`api` or `cli`).

**Path parameters**

| Name     | Type     | Description                                 |
| -------- | -------- | ------------------------------------------- |
| `target` | `string` | Automation target without a version suffix. |

**Query parameters**

| Name                  | Type     | Description                                                   |
| --------------------- | -------- | ------------------------------------------------------------- |
| `version`             | `string` | (optional)Optional version or source ref. Defaults to latest. |
| `wait_for_completion` | `number` | (optional)                                                    |

**Request body**

```ts
// RunTargetInputBody
```

**Response**

```ts
// RunStartResponse
```

### `client.runs.artifacts.download`

**`GET /api/v1/runs/{id}/artifact/{path}`**

Download run artifact

Download an agent run artifact such as input/output JSON, trace.jsonl, issues.md, metadata, or files under input/ and output/. Workflow run file rows are exposed through /files.

**Path parameters**

| Name   | Type     | Description |
| ------ | -------- | ----------- |
| `id`   | `string` |             |
| `path` | `string` |             |

### `client.runs.cancel`

**`POST /api/v1/runs/{id}/cancel`**

Cancel run

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.comparison.get`

**`GET /api/v1/runs/{id}/comparison`**

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

**`POST /api/v1/runs/{id}/connect`**

Connect to live run

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.expected.download`

**`GET /api/v1/runs/{id}/expected/{filename}`**

Download expected artifact file

**Path parameters**

| Name       | Type     | Description |
| ---------- | -------- | ----------- |
| `id`       | `string` |             |
| `filename` | `string` |             |

### `client.runs.expected.rename`

**`PATCH /api/v1/runs/{id}/expected/{filename}`**

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

**`DELETE /api/v1/runs/{id}/expected/{filename}`**

Delete expected artifact file

**Path parameters**

| Name       | Type     | Description |
| ---------- | -------- | ----------- |
| `id`       | `string` |             |
| `filename` | `string` |             |

### `client.runs.expected.list`

**`GET /api/v1/runs/{id}/expected`**

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

**`POST /api/v1/runs/{id}/expected`**

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

**`GET /api/v1/runs/{id}/feedback`**

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

**`PATCH /api/v1/runs/{id}/feedback`**

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

**`DELETE /api/v1/runs/{id}/feedback`**

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

**`GET /api/v1/runs/{id}/files-zip`**

Download run output files zip

Download agent run output artifacts as a zip. Workflow run files use /files and will be folded into artifacts in a future refactor.

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

**`DELETE /api/v1/runs/{id}/files/{fileId}`**

Delete run input file

**Path parameters**

| Name     | Type     | Description |
| -------- | -------- | ----------- |
| `id`     | `string` |             |
| `fileId` | `string` |             |

### `client.runs.files.list`

**`GET /api/v1/runs/{id}/files`**

List run files

List DB-backed workflow run files: mutable workflow inputs before execution starts, plus workflow/eval input and output file rows. Agent debug outputs are exposed as run artifacts instead.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// RunFilesResponse
```

### `client.runs.files.upload`

**`POST /api/v1/runs/{id}/files`**

Upload run input file

Upload a DB-backed workflow run input file. This endpoint is for workflow runs before execution starts; agent run downloads use artifacts.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.rerun`

**`POST /api/v1/runs/{id}/rerun`**

Rerun run

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Query parameters**

| Name                  | Type     | Description |
| --------------------- | -------- | ----------- |
| `wait_for_completion` | `number` | (optional)  |

**Request body**

```ts
// RunRerunRequest
```

**Response**

```ts
// RunRerunResponse
```

### `client.runs.resume`

**`POST /api/v1/runs/{id}/resume`**

Resume workflow run

Resume a workflow run that is waiting for approval.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id      |

**Response**

```ts
// RunResumeResponse
```

### `client.runs.get`

**`GET /api/v1/runs/{id}`**

Get run

Returns a run summary by default. Pass include=detail for the rich type-specific workflow or agent run payload.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id      |

**Query parameters**

| Name      | Type     | Description                                                            |
| --------- | -------- | ---------------------------------------------------------------------- |
| `include` | `string` | (optional)Comma-separated sections. Include `detail` for rich payload. |

**Response**

```ts
// RunEnvelope
```

### `client.runs.trace.get`

**`GET /api/v1/runs/{id}/trace`**

Get run trace

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// Record<string, unknown>
```

### `client.runs.list`

**`GET /api/v1/runs`**

List runs

Tenant-scoped, cursor-paginated feed of workflow and agent runs. Use type and source filters to scope to one runtime or resource.

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

**`GET /api/v1/workflows/{id}`**

Get a workflow by id

Returns the workflow summary plus the current version YAML. Use `versions list` for historical YAML.

**Path parameters**

| Name | Type     | Description                  |
| ---- | -------- | ---------------------------- |
| `id` | `string` | Workflow id (e.g. wf_abc123) |

**Response**

```ts
// WorkflowDetail
```

### `client.workflows.versions`

**`GET /api/v1/workflows/{id}/versions`**

List tagged versions for a workflow

Returns released versions in reverse-chronological order, paginated.

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

Returns workflows the API key has access to, with pagination. Use `name` for exact-match slug lookup, `search` for substring match.

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
