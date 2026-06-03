# @eigenpal/sdk reference

## Quick example

```ts
import { EigenpalClient } from '@eigenpal/sdk';

const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY });

// Run a workflow with a file input (multipart upload, no base64).
const result = await client.workflows.executions.runAndWait('extract-invoice', {
  contract: file, // File / Blob / { content, filename, mimeType }
});

console.log(result.status, result.result);
```

## Surface

```
client
├── agents
│   ├── list
│   ├── get
│   ├── create
│   ├── update
│   ├── run
│   ├── listFiles
│   ├── putFile
│   ├── uploadFiles
│   ├── emailTriggers.list
│   ├── emailTriggers.get
│   ├── emailTriggers.createAlias
│   ├── emailTriggers.deleteAlias
│   ├── emailTriggers.update
│   ├── emailTriggers.updateAlias
│   ├── runs.list
│   ├── runs.get
│   ├── runs.cancel
│   ├── runs.rerun
│   ├── runs.getFeedback
│   ├── runs.updateFeedback
│   ├── runs.clearFeedback
│   ├── runs.listExpected
│   ├── runs.copyOutputToExpected / uploadExpected
│   ├── runs.downloadExpected
│   ├── runs.renameExpected
│   ├── runs.deleteExpected
│   └── runs.downloadFile
├── workflows
│   ├── list
│   ├── get
│   ├── run
│   ├── versions
│   ├── executions.list
│   ├── executions.get
│   ├── executions.cancel
│   └── executions.runAndWait
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

### `client.agents.run`

**`POST /api/v1/agents/{agentId}/run`**

Run an agent

Enqueues an agent run. Returns 202 with `{ runId }` by default. Pass `wait_for_completion=<seconds>` to hold the connection until the run reaches a terminal state. File inputs are uploaded as multipart/form-data.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Query parameters**

| Name                  | Type     | Description                                                                                                                                                                                |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `wait_for_completion` | `number` | (optional)Seconds to hold the connection waiting for completion (max 600). Omit for async.                                                                                                 |
| `sourceRef`           | `string` | (optional)Git source ref to resolve for this run. Defaults to latest. Supports latest, main, exact versions/tags such as 1.2.3, semver ranges such as 1.2.x or 1.x, and exact commit SHAs. |

**Request body**

```ts
// RunAgentBody
```

**Response**

```ts
// RunAgentResponse
```

### `client.agents.runs.list`

**`GET /api/v1/agents/{agentId}/runs`**

List agent runs

Returns runs for an agent, optionally filtered by status or experiment batch.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Query parameters**

| Name                     | Type                                                      | Description                                                           |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------- |
| `status`                 | `string`                                                  | (optional)Run status filter                                           |
| `batchId`                | `string`                                                  | (optional)Experiment batch id filter                                  |
| `exampleId`              | `string`                                                  | (optional)Exact dataset example id (folder name) filter               |
| `exampleIdContains`      | `string`                                                  | (optional)Substring match on dataset example id                       |
| `createdAfter`           | `string`                                                  | (optional)Only runs created at/after this ISO timestamp               |
| `createdBefore`          | `string`                                                  | (optional)Only runs created at/before this ISO timestamp              |
| `completedAfter`         | `string`                                                  | (optional)Only runs completed at/after this ISO timestamp             |
| `completedBefore`        | `string`                                                  | (optional)Only runs completed at/before this ISO timestamp            |
| `sourceRef`              | `string`                                                  | (optional)Filter by the source ref requested when the run was created |
| `feedbackStatus`         | `"open" \| "resolved" \| "ignored"`                       | (optional)                                                            |
| `feedbackRating`         | `"pass" \| "fail" \| "partial" \| "none"`                 | (optional)                                                            |
| `hasFeedback`            | `boolean`                                                 | (optional)                                                            |
| `noFeedback`             | `boolean`                                                 | (optional)                                                            |
| `hasExpected`            | `boolean`                                                 | (optional)                                                            |
| `hasExpectedJson`        | `boolean`                                                 | (optional)                                                            |
| `hasExpectedFiles`       | `boolean`                                                 | (optional)                                                            |
| `feedbackBodyContains`   | `string`                                                  | (optional)                                                            |
| `feedbackCreatedAfter`   | `string`                                                  | (optional)                                                            |
| `feedbackCreatedBefore`  | `string`                                                  | (optional)                                                            |
| `feedbackUpdatedAfter`   | `string`                                                  | (optional)                                                            |
| `feedbackUpdatedBefore`  | `string`                                                  | (optional)                                                            |
| `feedbackResolvedAfter`  | `string`                                                  | (optional)                                                            |
| `feedbackResolvedBefore` | `string`                                                  | (optional)                                                            |
| `promotedToExample`      | `boolean`                                                 | (optional)                                                            |
| `promotedExampleName`    | `string`                                                  | (optional)                                                            |
| `sinceLastResolved`      | `boolean`                                                 | (optional)                                                            |
| `include`                | `string`                                                  | (optional)Comma-separated extra parts: feedback, expected, files      |
| `sort`                   | `"createdAt" \| "completedAt" \| "status" \| "exampleId"` | (optional)                                                            |
| `order`                  | `"asc" \| "desc"`                                         | (optional)                                                            |
| `scanLimit`              | `number`                                                  | (optional)                                                            |
| `limit`                  | `number`                                                  | (optional)                                                            |
| `offset`                 | `number`                                                  | (optional)                                                            |

**Response**

```ts
// ListAgentRunsResponse
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

### `client.agents.runs.cancel`

**`POST /api/v1/agents/runs/{runId}/cancel`**

Cancel agent run

Requests cancellation for one agent run by id.

**Path parameters**

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `runId` | `string` | Run id      |

**Response**

```ts
// CancelAgentExecutionResponse
```

### `client.agents.runs.downloadExpected`

**`GET /api/v1/agents/runs/{runId}/expected/{filename}`**

Download an expected file

Downloads one expected file attached to an agent run.

**Path parameters**

| Name       | Type     | Description            |
| ---------- | -------- | ---------------------- |
| `runId`    | `string` | Run id                 |
| `filename` | `string` | Expected artifact path |

### `client.agents.runs.renameExpected`

**`PATCH /api/v1/agents/runs/{runId}/expected/{filename}`**

Rename an expected file

Renames one expected file attached to an agent run.

**Path parameters**

| Name       | Type     | Description            |
| ---------- | -------- | ---------------------- |
| `runId`    | `string` | Run id                 |
| `filename` | `string` | Expected artifact path |

**Request body**

```ts
// RenameExpectedFileBody
```

**Response**

```ts
// RenameExpectedFileResponse
```

### `client.agents.runs.deleteExpected`

**`DELETE /api/v1/agents/runs/{runId}/expected/{filename}`**

Delete an expected file

Deletes one expected file attached to an agent run.

**Path parameters**

| Name       | Type     | Description            |
| ---------- | -------- | ---------------------- |
| `runId`    | `string` | Run id                 |
| `filename` | `string` | Expected artifact path |

### `client.agents.runs.listExpected`

**`GET /api/v1/agents/runs/{runId}/expected`**

List run expected artifacts

Returns structured expected JSON and expected file names for one run.

**Path parameters**

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `runId` | `string` | Run id      |

**Response**

```ts
// AgentExecutionExpectedArtifacts
```

### `client.agents.runs.copyOutputToExpected / uploadExpected`

**`POST /api/v1/agents/runs/{runId}/expected`**

Create an expected file

Uploads an expected file with multipart/form-data, or copies a generated output file into expected artifacts with JSON.

**Path parameters**

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `runId` | `string` | Run id      |

**Request body**

```ts
// CopyAgentExecutionOutputToExpectedBody
```

**Response**

```ts
// Record<string, unknown>
```

### `client.agents.runs.getFeedback`

**`GET /api/v1/agents/runs/{runId}/feedback`**

Get run feedback

Returns feedback and expected artifacts attached to one agent run.

**Path parameters**

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `runId` | `string` | Run id      |

**Response**

```ts
// AgentExecutionFeedbackDetail
```

### `client.agents.runs.updateFeedback`

**`PATCH /api/v1/agents/runs/{runId}/feedback`**

Update run feedback

Updates the feedback body, rating, status, or structured expected JSON attached to one run.

**Path parameters**

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `runId` | `string` | Run id      |

**Request body**

```ts
// UpdateAgentExecutionFeedbackBody
```

**Response**

```ts
// AgentExecutionFeedbackDetail
```

### `client.agents.runs.clearFeedback`

**`DELETE /api/v1/agents/runs/{runId}/feedback`**

Clear run feedback

Deletes feedback, structured expected JSON, and expected files from one run.

**Path parameters**

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `runId` | `string` | Run id      |

**Response**

```ts
// AgentExecutionFeedbackDetail
```

### `client.agents.runs.downloadFile`

**`GET /api/v1/agents/runs/{runId}/files/{path}`**

Download a run file

Downloads an artifact path attached to an agent run, such as input.json, output/result.json, output.json, issues.md, trace.jsonl, or eigenpal.lock.

**Path parameters**

| Name    | Type       | Description |
| ------- | ---------- | ----------- |
| `runId` | `string`   |             |
| `path`  | `string[]` |             |

### `client.agents.runs.rerun`

**`POST /api/v1/agents/runs/{runId}/rerun`**

Rerun agent run

Creates a new run for the same agent using a previous run's stored input snapshot.

**Path parameters**

| Name    | Type     | Description   |
| ------- | -------- | ------------- |
| `runId` | `string` | Source run id |

**Response**

```ts
// RerunAgentRunResponse
```

### `client.agents.runs.get`

**`GET /api/v1/agents/runs/{runId}`**

Get agent run

Returns one agent run by id.

**Path parameters**

| Name    | Type     | Description |
| ------- | -------- | ----------- |
| `runId` | `string` | Run id      |

**Query parameters**

| Name      | Type     | Description                                                               |
| --------- | -------- | ------------------------------------------------------------------------- |
| `include` | `string` | (optional)Comma-separated optional sections, e.g. feedback,expected,files |

**Response**

```ts
// AgentRunResponse
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

### `client.workflows.executions.list`

**`GET /api/v1/workflows/{id}/executions`**

List workflow executions

Returns executions for a workflow, optionally filtered by status, date range, or eval example. Paginated.

**Path parameters**

| Name | Type     | Description                  |
| ---- | -------- | ---------------------------- |
| `id` | `string` | Workflow id (e.g. wf_abc123) |

**Query parameters**

| Name        | Type     | Description                                                                                              |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `status`    | `string` | (optional)Comma-separated list of execution statuses to filter by                                        |
| `fromDate`  | `string` | (optional)ISO-8601 timestamp or relative expression (e.g. "now()-7d") for the lower bound on `createdAt` |
| `toDate`    | `string` | (optional)Upper bound on `createdAt`                                                                     |
| `exampleId` | `string` | (optional)Filter to executions launched from a specific eval example                                     |
| `limit`     | `number` | (optional)                                                                                               |
| `offset`    | `number` | (optional)                                                                                               |

**Response**

```ts
// ListWorkflowExecutionsResponse
```

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

### `client.workflows.run`

**`POST /api/v1/workflows/{id}/run`**

Execute a workflow (async or sync)

Enqueues a workflow execution. Returns 201 with `{ executionId }` by default. Pass `wait_for_completion=<seconds>` (max 60) to hold the connection until the run reaches a terminal state; the body then also includes `status`, `result`, and `error`. File inputs are uploaded as `multipart/form-data` (each file as a top-level form field; `_json` field carries scalar inputs).

**Path parameters**

| Name | Type     | Description                                                                           |
| ---- | -------- | ------------------------------------------------------------------------------------- |
| `id` | `string` | Workflow id (e.g. `wf_abc123`) or slug (e.g. `extract-invoice`, the workflow `name`). |

**Query parameters**

| Name                  | Type     | Description                                                                               |
| --------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `version`             | `string` | (optional)Version id, or "latest" (default)                                               |
| `wait_for_completion` | `number` | (optional)Seconds to hold the connection waiting for completion (max 60). Omit for async. |

**Request body**

```ts
// RunWorkflowBody
```

**Response**

```ts
// RunWorkflowResponse
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

### `client.workflows.executions.cancel`

**`POST /api/v1/workflows/executions/{executionId}/cancel`**

Cancel a workflow execution

Idempotent. Created/pending executions transition immediately to `cancelled`; running/waiting executions receive a cancellation request for the worker to observe.

**Path parameters**

| Name          | Type     | Description            |
| ------------- | -------- | ---------------------- |
| `executionId` | `string` | Execution id to cancel |

**Response**

```ts
// CancelWorkflowExecutionResponse
```

### `client.workflows.executions.get`

**`GET /api/v1/workflows/executions/{executionId}`**

Get workflow execution status

Returns the current status, completion timestamps, and result or error for a workflow execution. Pass `includeSteps=true` for the per-step artifact payload.

**Path parameters**

| Name          | Type     | Description                  |
| ------------- | -------- | ---------------------------- |
| `executionId` | `string` | Execution id (e.g. exec_xyz) |

**Query parameters**

| Name           | Type                | Description                                                                               |
| -------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `includeSteps` | `"true" \| "false"` | (optional)When "true", returns the full per-step execution payload instead of the summary |

**Response**

```ts
// WorkflowExecutionStatusResponse | ExecutionSummary
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
