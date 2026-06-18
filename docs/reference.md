# @eigenpal/sdk reference

## Quick example

```ts
import { EigenpalClient } from '@eigenpal/sdk';

const client = new EigenpalClient({ apiKey: process.env.EIGENPAL_API_KEY });

// Run a workflow with a file input (multipart upload, no base64).
const result = await client.run(
  'workflows.extract-invoice',
  { contract: file }, // File / Blob / { content, filename, mimeType }
  { waitForCompletion: 60 }
);

console.log(result.finished, result.output);
```

## Surface

```
client
├── run
├── rerun
├── automations
│   ├── list
│   ├── get
│   ├── versions
│   ├── dataset
│   │   ├── export
│   │   └── import
│   ├── evaluators
│   │   ├── get
│   │   └── update
│   ├── examples
│   │   ├── list
│   │   ├── get
│   │   ├── create
│   │   ├── delete
│   │   ├── run
│   │   └── update
│   ├── experiments
│   │   ├── list
│   │   ├── get
│   │   ├── cancel
│   │   └── create
│   └── triggers
├── runs
│   ├── list
│   ├── get
│   ├── artifacts
│   │   ├── list
│   │   └── download
│   ├── cancel
│   ├── evalResults
│   │   └── list
│   ├── events
│   ├── feedback
│   │   ├── get
│   │   ├── clear
│   │   └── update
│   ├── promote
│   ├── steps
│   ├── trace
│   │   └── get
│   └── usage
├── files
│   ├── get
│   ├── delete
│   ├── download
│   └── upload
└── auth
    └── check
```

Start runs with `client.run(...)` and create a new run from a previous snapshot with `client.rerun(...)`.

Run inspection, artifacts, traces, usage, events, and feedback live under `client.runs.*`, which maps to `/api/v1/runs`.

Reusable upload-first files live under `client.files.*`; once a file is referenced by a run, Eigenpal snapshots it into run-scoped artifacts.

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

## Metadata

### `client.auth.check`

**`GET /api/v1/auth/check`**

Check API key identity

Return the tenant, user, API key, and scope represented by the current API key.

**Response**

```ts
// AuthCheckResponse
```

## Evaluation

### `client.automations.dataset.export`

**`GET /api/v1/automations/:id/dataset/export`**

Export automation dataset

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Query parameters**

| Name         | Type     | Description |
| ------------ | -------- | ----------- |
| `exampleIds` | `string` | (optional)  |

**Response**

```ts
// string
```

### `client.automations.dataset.import`

**`POST /api/v1/automations/:id/dataset/import`**

Import automation dataset

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// DatasetImportResponse
```

### `client.automations.evaluators.get`

**`GET /api/v1/automations/:id/evaluators`**

Get automation evaluators

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// EvaluatorConfigResponse
```

### `client.automations.evaluators.update`

**`PUT /api/v1/automations/:id/evaluators`**

Replace automation evaluators

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Request body**

```ts
// EvaluatorConfigUpdate
```

**Response**

```ts
// EvaluatorConfigResponse
```

### `client.automations.examples.get`

**`GET /api/v1/automations/:id/examples/:exampleId`**

Get automation example

**Path parameters**

| Name        | Type     | Description |
| ----------- | -------- | ----------- |
| `id`        | `string` |             |
| `exampleId` | `string` |             |

**Response**

```ts
// DatasetExample
```

### `client.automations.examples.update`

**`PATCH /api/v1/automations/:id/examples/:exampleId`**

Update automation example

**Path parameters**

| Name        | Type     | Description |
| ----------- | -------- | ----------- |
| `id`        | `string` |             |
| `exampleId` | `string` |             |

**Request body**

```ts
// DatasetExampleUpdate
```

**Response**

```ts
// DatasetExample
```

### `client.automations.examples.delete`

**`DELETE /api/v1/automations/:id/examples/:exampleId`**

Delete automation example

**Path parameters**

| Name        | Type     | Description |
| ----------- | -------- | ----------- |
| `id`        | `string` |             |
| `exampleId` | `string` |             |

**Response**

```ts
// DatasetExample
```

### `client.automations.examples.run`

**`POST /api/v1/automations/:id/examples/:exampleId/run`**

Run automation example

**Path parameters**

| Name        | Type     | Description |
| ----------- | -------- | ----------- |
| `id`        | `string` |             |
| `exampleId` | `string` |             |

**Response**

```ts
// ExampleRunResponse
```

### `client.automations.examples.list`

**`GET /api/v1/automations/:id/examples`**

List automation examples

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Query parameters**

| Name     | Type     | Description |
| -------- | -------- | ----------- |
| `limit`  | `number` | (optional)  |
| `offset` | `number` | (optional)  |

**Response**

```ts
// DatasetExampleList
```

### `client.automations.examples.create`

**`POST /api/v1/automations/:id/examples`**

Create automation example

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Request body**

```ts
// DatasetExampleMutation
```

**Response**

```ts
// DatasetExample
```

### `client.automations.experiments.list`

**`GET /api/v1/automations/:id/experiments`**

List automation experiments

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Query parameters**

| Name     | Type     | Description |
| -------- | -------- | ----------- |
| `limit`  | `number` | (optional)  |
| `offset` | `number` | (optional)  |

**Response**

```ts
// Record<string, unknown>
```

### `client.automations.experiments.create`

**`POST /api/v1/automations/:id/experiments`**

Create automation experiment

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Request body**

```ts
// ExperimentCreate
```

**Response**

```ts
// ExperimentCreateResponse
```

### `client.automations.experiments.cancel`

**`POST /api/v1/automations/:id/experiments/:experimentId/cancel`**

Cancel automation experiment

**Path parameters**

| Name           | Type     | Description |
| -------------- | -------- | ----------- |
| `id`           | `string` |             |
| `experimentId` | `string` |             |

**Response**

```ts
// ExperimentDetail
```

### `client.automations.experiments.get`

**`GET /api/v1/automations/:id/experiments/:experimentId`**

Get automation experiment

**Path parameters**

| Name           | Type     | Description |
| -------------- | -------- | ----------- |
| `id`           | `string` |             |
| `experimentId` | `string` |             |

**Response**

```ts
// ExperimentDetail
```

### `client.runs.evalResults.list`

**`GET /api/v1/runs/:id/eval-results`**

List run eval results

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Response**

```ts
// EvalResultsResponse
```

## Automations

### `client.automations.get`

**`GET /api/v1/automations/:id`**

Get automation

Get one runnable workflow or agent automation by id or typed alias.

**Path parameters**

| Name | Type     | Description                                                             |
| ---- | -------- | ----------------------------------------------------------------------- |
| `id` | `string` | Workflow id, agent id, or typed alias like workflows.slug / agents.slug |

**Response**

```ts
// AutomationDetail
```

### `client.automations.triggers`

**`GET /api/v1/automations/:id/triggers`**

Get automation triggers

Read trigger state for a workflow or agent automation. Trigger mutation is not public v1.

**Path parameters**

| Name | Type     | Description                                                             |
| ---- | -------- | ----------------------------------------------------------------------- |
| `id` | `string` | Workflow id, agent id, or typed alias like workflows.slug / agents.slug |

**Response**

```ts
// AutomationTriggersResponse
```

### `client.automations.versions`

**`GET /api/v1/automations/:id/versions`**

List automation versions

List versions for a workflow or agent automation through one read-only route.

**Path parameters**

| Name | Type     | Description                                                             |
| ---- | -------- | ----------------------------------------------------------------------- |
| `id` | `string` | Workflow id, agent id, or typed alias like workflows.slug / agents.slug |

**Response**

```ts
// ListAutomationVersionsResponse
```

### `client.automations.list`

**`GET /api/v1/automations`**

List automations

List runnable workflow and agent automations in one collection.

**Query parameters**

| Name     | Type                    | Description                                                  |
| -------- | ----------------------- | ------------------------------------------------------------ |
| `search` | `string`                | (optional)Substring match against slug, name, or description |
| `type`   | `"workflow" \| "agent"` | (optional)Filter by implementation type                      |
| `limit`  | `number`                | (optional)                                                   |
| `offset` | `number`                | (optional)                                                   |

**Response**

```ts
// ListAutomationsResponse
```

## Files

### `client.files.download`

**`GET /api/v1/files/:id/content`**

Download file content

Download bytes for a reusable uploaded file.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | File id     |

### `client.files.get`

**`GET /api/v1/files/:id`**

Get file metadata

Get metadata for a reusable uploaded file.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | File id     |

**Response**

```ts
// File
```

### `client.files.delete`

**`DELETE /api/v1/files/:id`**

Delete file

Delete a reusable uploaded file. Historical run and dataset snapshots are separate artifacts.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | File id     |

**Response**

```ts
// DeleteFileResponse
```

### `client.files.upload`

**`POST /api/v1/files`**

Upload file

Upload a reusable file that can later be referenced by run inputs or dataset examples.

**Response**

```ts
// File
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

### `client.runs.events`

**`GET /api/v1/runs/:id/events`**

List run events

List a stable chronological lifecycle timeline for a run.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id      |

**Response**

```ts
// RunEventsResponse
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
// RunFeedbackDetail
```

### `client.runs.feedback.update`

**`PUT /api/v1/runs/:id/feedback`**

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
// RunFeedbackDetail
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
// RunFeedbackDetail
```

### `client.runs.promote`

**`POST /api/v1/runs/:id/promote`**

Promote a run to a dataset example

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Request body**

```ts
// PromoteRunRequest
```

**Response**

```ts
// PromoteRunResponse
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

### `client.runs.steps`

**`GET /api/v1/runs/:id/steps`**

List run steps

List workflow steps or an agent-compatible execution step summary for a run.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id      |

**Response**

```ts
// RunStepsResponse
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

### `client.runs.usage`

**`GET /api/v1/runs/:id/usage`**

Get run usage

Get token, credit, duration, and execution usage for a run.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id      |

**Response**

```ts
// RunUsageResponse
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
