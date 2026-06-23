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
│   ├── sync
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
│   │   ├── expectedFile
│   │   │   ├── get
│   │   │   ├── delete
│   │   │   └── update
│   │   ├── expectedFiles
│   │   │   ├── list
│   │   │   └── create
│   │   ├── inputFile
│   │   │   ├── get
│   │   │   ├── delete
│   │   │   └── update
│   │   ├── inputFiles
│   │   │   ├── list
│   │   │   └── create
│   │   ├── run
│   │   └── update
│   ├── experiments
│   │   ├── list
│   │   ├── get
│   │   ├── cancel
│   │   ├── create
│   │   ├── createStream
│   │   ├── export
│   │   └── exportAll
│   ├── reviews
│   │   └── health
│   └── triggers
├── runs
│   ├── list
│   ├── get
│   ├── artifacts
│   │   ├── list
│   │   └── download
│   ├── cancel
│   ├── events
│   ├── promote
│   ├── reviews
│   │   ├── get
│   │   ├── listExpected
│   │   ├── copyOutputToExpected / uploadExpected
│   │   ├── downloadExpected
│   │   ├── renameExpected
│   │   ├── deleteExpected
│   │   ├── clear
│   │   └── update
│   ├── scores
│   │   └── list
│   ├── steps
│   ├── trace
│   │   └── get
│   └── usage
├── files
│   ├── get
│   ├── delete
│   ├── download
│   └── upload
├── auth
│   └── check
└── experiments
    └── resolve
```

Start runs with `client.run(...)` and create a new run from a previous snapshot with `client.rerun(...)`.

Run inspection, artifacts, traces, usage, events, and reviews live under `client.runs.*`, which maps to `/api/v1/runs`.

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

## Automations

### `client.automations.list`

**`GET /api/v1/automations`**

List automations

Returns workflows and agents through one runnable automation collection. Use `type` to narrow to workflows or agents, and `search` to find automations by slug, name, or description.

**Query parameters**

| Name     | Type                    | Description                                                  |
| -------- | ----------------------- | ------------------------------------------------------------ |
| `search` | `string`                | (optional)Substring match against slug, name, or description |
| `type`   | `"workflow" \| "agent"` | (optional)Filter by implementation type                      |
| `limit`  | `number`                | (optional)Maximum number of automations to return.           |
| `offset` | `number`                | (optional)Zero-based offset for paging through automations.  |

**Response**

```ts
// ListAutomationsResponse
```

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

### `client.automations.sync`

**`POST /api/v1/automations/:id/sync`**

Sync automation from latest Git release

Reconciles automation registry metadata and trigger projections from the latest Git source release. This operation is idempotent for unchanged source state: repeated calls against the same latest release leave the same automation registry state and may repeat the same warnings. Requires a Bearer API token for the organization and a user-backed API key. It does not publish source; it reads the already-published latest release manifest. Versioned targets are rejected with 400, missing organization/source/release/manifest state returns 404, invalid manifests return 400, and provider or persistence failures return 5xx.

**Path parameters**

| Name | Type     | Description                                                                                                                                      |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id` | `string` | Automation target to sync, such as agents.invoice-agent or workflows.extract. Do not include a version; sync always uses the latest Git release. |

**Response**

```ts
// Record<string, unknown>
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

## Evaluation

### `client.automations.dataset.export`

**`GET /api/v1/automations/:id/dataset/export`**

Export automation dataset

Download the automation dataset as a ZIP archive. The archive uses the examples/<name>/input and examples/<name>/expected folder convention, so it can be re-imported into another automation or environment.

**Path parameters**

| Name | Type     | Description                   |
| ---- | -------- | ----------------------------- |
| `id` | `string` | Automation id or typed alias. |

**Query parameters**

| Name         | Type     | Description                                                                                        |
| ------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `exampleIds` | `string` | (optional)Optional comma-separated dataset example ids to export. Omit to export the full dataset. |

**Response**

```ts
// Blob
```

### `client.automations.dataset.import`

**`POST /api/v1/automations/:id/dataset/import`**

Import automation dataset

Import a dataset ZIP archive using the examples/<name>/input and examples/<name>/expected folder convention. Use `mode=append` for additive imports or `mode=replace` to replace the dataset.

**Path parameters**

| Name | Type     | Description                   |
| ---- | -------- | ----------------------------- |
| `id` | `string` | Automation id or typed alias. |

**Response**

```ts
// DatasetImportResponse
```

### `client.automations.evaluators.get`

**`GET /api/v1/automations/:id/evaluators`**

Get evaluators

Fetch the evaluator configuration for an automation. Evaluators produce automated `score` results, which are separate from human review verdicts.

**Path parameters**

| Name | Type     | Description                   |
| ---- | -------- | ----------------------------- |
| `id` | `string` | Automation id or typed alias. |

**Response**

```ts
// EvaluatorConfigResponse
```

### `client.automations.evaluators.update`

**`PUT /api/v1/automations/:id/evaluators`**

Replace evaluators

Replace the evaluator YAML for an automation. The submitted YAML is validated before it becomes the source for future experiment scores.

**Path parameters**

| Name | Type     | Description                   |
| ---- | -------- | ----------------------------- |
| `id` | `string` | Automation id or typed alias. |

**Request body**

```ts
// EvaluatorConfigUpdate
```

**Response**

```ts
// EvaluatorConfigResponse
```

### `client.automations.examples.list`

**`GET /api/v1/automations/:id/examples`**

List dataset examples

List dataset examples for one automation. Examples contain input, expected output, expected files, metadata, and optional overrides used by evaluation runs.

**Path parameters**

| Name | Type     | Description                                                              |
| ---- | -------- | ------------------------------------------------------------------------ |
| `id` | `string` | Automation id or typed alias, such as `workflows.slug` or `agents.slug`. |

**Query parameters**

| Name     | Type     | Description                                              |
| -------- | -------- | -------------------------------------------------------- |
| `limit`  | `number` | (optional)Maximum number of examples to return.          |
| `offset` | `number` | (optional)Zero-based offset for paging through examples. |

**Response**

```ts
// DatasetExampleList
```

### `client.automations.examples.create`

**`POST /api/v1/automations/:id/examples`**

Create dataset example

Create one dataset example from JSON fields. Use dataset import for archive-based uploads and file-bearing examples.

**Path parameters**

| Name | Type     | Description                                                              |
| ---- | -------- | ------------------------------------------------------------------------ |
| `id` | `string` | Automation id or typed alias, such as `workflows.slug` or `agents.slug`. |

**Request body**

```ts
// DatasetExampleMutation
```

**Response**

```ts
// DatasetExample
```

### `client.automations.examples.get`

**`GET /api/v1/automations/:id/examples/:exampleId`**

Get dataset example

Fetch one dataset example, including input, expected output, expected files, metadata, and overrides.

**Path parameters**

| Name        | Type     | Description                                                                                                  |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `id`        | `string` | Automation id or typed alias.                                                                                |
| `exampleId` | `string` | Dataset example id. Agent examples may use deterministic name-derived ids returned by list/create responses. |

**Response**

```ts
// DatasetExample
```

### `client.automations.examples.update`

**`PATCH /api/v1/automations/:id/examples/:exampleId`**

Update dataset example

Partially update a dataset example. Omitted fields are preserved; pass null for nullable fields to clear them.

**Path parameters**

| Name        | Type     | Description                                                                                                  |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `id`        | `string` | Automation id or typed alias.                                                                                |
| `exampleId` | `string` | Dataset example id. Agent examples may use deterministic name-derived ids returned by list/create responses. |

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

Delete dataset example

Delete one dataset example from the automation dataset. This removes the example from future experiments.

**Path parameters**

| Name        | Type     | Description                                                                                                  |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `id`        | `string` | Automation id or typed alias.                                                                                |
| `exampleId` | `string` | Dataset example id. Agent examples may use deterministic name-derived ids returned by list/create responses. |

**Response**

```ts
// DatasetExample
```

### `client.automations.examples.expectedFiles.list`

**`GET /api/v1/automations/:id/examples/:exampleId/expected`**

List expected files

List files stored under the expected folder for one automation dataset example.

**Path parameters**

| Name        | Type     | Description                   |
| ----------- | -------- | ----------------------------- |
| `id`        | `string` | Automation id or typed alias. |
| `exampleId` | `string` | Dataset example id.           |

**Response**

```ts
// DatasetExampleExpectedFileList
```

### `client.automations.examples.expectedFiles.create`

**`POST /api/v1/automations/:id/examples/:exampleId/expected`**

Upload expected files

Upload one or more files into the expected folder for an automation dataset example. Use `$file` references such as `expected/result.pdf` from expected JSON to compare file outputs.

**Path parameters**

| Name        | Type     | Description                   |
| ----------- | -------- | ----------------------------- |
| `id`        | `string` | Automation id or typed alias. |
| `exampleId` | `string` | Dataset example id.           |

**Response**

```ts
// DatasetExampleExpectedFileUploadResponse
```

### `client.automations.examples.expectedFile.get`

**`GET /api/v1/automations/:id/examples/:exampleId/expected/:path`**

Download expected dataset file

Download one expected file attached to an automation dataset example.

**Path parameters**

| Name        | Type     | Description                             |
| ----------- | -------- | --------------------------------------- |
| `id`        | `string` | Automation id or typed alias.           |
| `exampleId` | `string` | Dataset example id.                     |
| `path`      | `string` | Path under the example expected folder. |

**Response**

```ts
// Blob
```

### `client.automations.examples.expectedFile.update`

**`PATCH /api/v1/automations/:id/examples/:exampleId/expected/:path`**

Rename expected file

Rename one expected file attached to an automation dataset example. The parent folder is preserved.

**Path parameters**

| Name        | Type     | Description                             |
| ----------- | -------- | --------------------------------------- |
| `id`        | `string` | Automation id or typed alias.           |
| `exampleId` | `string` | Dataset example id.                     |
| `path`      | `string` | Path under the example expected folder. |

**Request body**

```ts
// DatasetExampleExpectedFileRenameRequest
```

**Response**

```ts
// DatasetExampleExpectedFileRenameResponse
```

### `client.automations.examples.expectedFile.delete`

**`DELETE /api/v1/automations/:id/examples/:exampleId/expected/:path`**

Delete expected file

Delete one file from an automation dataset example expected folder.

**Path parameters**

| Name        | Type     | Description                             |
| ----------- | -------- | --------------------------------------- |
| `id`        | `string` | Automation id or typed alias.           |
| `exampleId` | `string` | Dataset example id.                     |
| `path`      | `string` | Path under the example expected folder. |

### `client.automations.examples.inputFiles.list`

**`GET /api/v1/automations/:id/examples/:exampleId/input`**

List input files

List files stored under the input folder for one automation dataset example.

**Path parameters**

| Name        | Type     | Description                   |
| ----------- | -------- | ----------------------------- |
| `id`        | `string` | Automation id or typed alias. |
| `exampleId` | `string` | Dataset example id.           |

**Response**

```ts
// DatasetExampleInputFileList
```

### `client.automations.examples.inputFiles.create`

**`POST /api/v1/automations/:id/examples/:exampleId/input`**

Upload input files

Upload one or more files into the input folder for an automation dataset example. Use `$file` references such as `input/invoice.pdf` from the example input JSON to consume them.

**Path parameters**

| Name        | Type     | Description                   |
| ----------- | -------- | ----------------------------- |
| `id`        | `string` | Automation id or typed alias. |
| `exampleId` | `string` | Dataset example id.           |

**Response**

```ts
// DatasetExampleInputFileUploadResponse
```

### `client.automations.examples.inputFile.get`

**`GET /api/v1/automations/:id/examples/:exampleId/input/:path`**

Download input file

Download one file from an automation dataset example input folder.

**Path parameters**

| Name        | Type     | Description                                          |
| ----------- | -------- | ---------------------------------------------------- |
| `id`        | `string` | Automation id or typed alias.                        |
| `exampleId` | `string` | Dataset example id.                                  |
| `path`      | `string` | Slash-delimited path under the example input folder. |

**Response**

```ts
// Blob
```

### `client.automations.examples.inputFile.update`

**`PATCH /api/v1/automations/:id/examples/:exampleId/input/:path`**

Rename input file

Rename one input file attached to an automation dataset example. The parent folder is preserved.

**Path parameters**

| Name        | Type     | Description                                          |
| ----------- | -------- | ---------------------------------------------------- |
| `id`        | `string` | Automation id or typed alias.                        |
| `exampleId` | `string` | Dataset example id.                                  |
| `path`      | `string` | Slash-delimited path under the example input folder. |

**Request body**

```ts
// DatasetExampleInputFileRenameRequest
```

**Response**

```ts
// DatasetExampleInputFileRenameResponse
```

### `client.automations.examples.inputFile.delete`

**`DELETE /api/v1/automations/:id/examples/:exampleId/input/:path`**

Delete input file

Delete one file from an automation dataset example input folder.

**Path parameters**

| Name        | Type     | Description                                          |
| ----------- | -------- | ---------------------------------------------------- |
| `id`        | `string` | Automation id or typed alias.                        |
| `exampleId` | `string` | Dataset example id.                                  |
| `path`      | `string` | Slash-delimited path under the example input folder. |

### `client.automations.examples.run`

**`POST /api/v1/automations/:id/examples/:exampleId/run`**

Run dataset example

Start an asynchronous run using the input from one dataset example. Poll `GET /api/v1/runs/:id` for completion and use run scores or review endpoints to review the result.

**Path parameters**

| Name        | Type     | Description                   |
| ----------- | -------- | ----------------------------- |
| `id`        | `string` | Automation id or typed alias. |
| `exampleId` | `string` | Dataset example id to run.    |

**Response**

```ts
// ExampleRunResponse
```

### `client.automations.experiments.list`

**`GET /api/v1/automations/:id/experiments`**

List experiments

List experiment batches for one automation. Each experiment runs selected dataset examples and records automated evaluator scores.

**Path parameters**

| Name | Type     | Description                   |
| ---- | -------- | ----------------------------- |
| `id` | `string` | Automation id or typed alias. |

**Query parameters**

| Name       | Type     | Description                                                                             |
| ---------- | -------- | --------------------------------------------------------------------------------------- |
| `limit`    | `number` | (optional)Maximum number of experiment batches to return.                               |
| `offset`   | `number` | (optional)Zero-based offset for paging through experiment batches.                      |
| `fromDate` | `string` | (optional)Filter to experiment batches created at or after this date or relative date.  |
| `toDate`   | `string` | (optional)Filter to experiment batches created at or before this date or relative date. |

**Response**

```ts
// Record<string, unknown>
```

### `client.automations.experiments.create`

**`POST /api/v1/automations/:id/experiments`**

Create experiment

Start an asynchronous experiment batch for one automation. Omit `examples` to run the full dataset, or pass specific example ids to run a subset.

**Path parameters**

| Name | Type     | Description                   |
| ---- | -------- | ----------------------------- |
| `id` | `string` | Automation id or typed alias. |

**Request body**

```ts
// ExperimentCreate
```

**Response**

```ts
// ExperimentCreateResponse
```

### `client.automations.experiments.get`

**`GET /api/v1/automations/:id/experiments/:experimentId`**

Get experiment

Fetch one experiment batch with its run summaries and evaluator results grouped by run id.

**Path parameters**

| Name           | Type     | Description                   |
| -------------- | -------- | ----------------------------- |
| `id`           | `string` | Automation id or typed alias. |
| `experimentId` | `string` | Experiment batch id.          |

**Response**

```ts
// ExperimentDetail
```

### `client.automations.experiments.cancel`

**`POST /api/v1/automations/:id/experiments/:experimentId/cancel`**

Cancel experiment

Request cancellation for an experiment batch. Already-completed runs remain recorded; queued or running work is cancelled when possible.

**Path parameters**

| Name           | Type     | Description                   |
| -------------- | -------- | ----------------------------- |
| `id`           | `string` | Automation id or typed alias. |
| `experimentId` | `string` | Experiment batch id.          |

**Response**

```ts
// ExperimentDetail
```

### `client.automations.experiments.export`

**`GET /api/v1/automations/:id/experiments/:experimentId/export`**

Export experiment eval results

Download eval result rows for a single experiment batch as CSV or JSON.

**Path parameters**

| Name           | Type     | Description |
| -------------- | -------- | ----------- |
| `id`           | `string` |             |
| `experimentId` | `string` |             |

**Query parameters**

| Name     | Type              | Description |
| -------- | ----------------- | ----------- |
| `format` | `"csv" \| "json"` |             |

**Response**

```ts
// string
```

### `client.automations.experiments.exportAll`

**`GET /api/v1/automations/:id/experiments/export`**

Export all experiment eval results

Download every eval result row for an automation as CSV or JSON.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` |             |

**Query parameters**

| Name     | Type              | Description |
| -------- | ----------------- | ----------- |
| `format` | `"csv" \| "json"` |             |

**Response**

```ts
// string
```

### `client.automations.experiments.createStream`

**`POST /api/v1/automations/:id/experiments/stream`**

Create automation experiment with NDJSON progress

Starts a batch eval experiment for workflow or agent automations and streams per-run completion events as NDJSON.

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
// string
```

### `client.experiments.resolve`

**`GET /api/v1/experiments/:experimentId`**

Resolve experiment by id

Returns the owning automation for an experiment batch id. Used when callers only know the experiment id.

**Path parameters**

| Name           | Type     | Description |
| -------------- | -------- | ----------- |
| `experimentId` | `string` |             |

**Response**

```ts
// ExperimentRef
```

### `client.runs.scores.list`

**`GET /api/v1/runs/:id/scores`**

List run evaluator scores

List automated evaluator results for one run. Use `score` for evaluator output and run reviews for human verdicts.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id.     |

**Response**

```ts
// RunScoresResponse
```

## Reviews

### `client.automations.reviews.health`

**`GET /api/v1/automations/:id/reviews/health`**

Get automation review health

Aggregates reviewed correctness, review coverage, bucketed counts, and rolling-window confidence for one automation. Prefer this endpoint for single-automation monitoring dashboards.

**Path parameters**

| Name | Type     | Description                                                              |
| ---- | -------- | ------------------------------------------------------------------------ |
| `id` | `string` | Workflow id, agent id, or typed alias like workflows.slug / agents.slug. |

**Query parameters**

| Name                | Type                         | Description                                                                             |
| ------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `type`              | `string`                     | (optional)Comma-separated: workflow,agent.                                              |
| `status`            | `string`                     | (optional)Comma-separated execution statuses.                                           |
| `trigger`           | `string`                     | (optional)Comma-separated trigger types.                                                |
| `triggeredBy`       | `string`                     | (optional)Comma-separated user ids, or **system** for system-triggered runs.            |
| `sourceRef`         | `string`                     | (optional)                                                                              |
| `batchId`           | `string`                     | (optional)                                                                              |
| `exampleId`         | `string`                     | (optional)                                                                              |
| `exampleIdContains` | `string`                     | (optional)                                                                              |
| `from`              | `string`                     | (optional)Start of the run-created time range. Defaults to now-30d.                     |
| `to`                | `string`                     | (optional)End of the run-created time range.                                            |
| `completedAfter`    | `string`                     | (optional)                                                                              |
| `completedBefore`   | `string`                     | (optional)                                                                              |
| `experiments`       | `string`                     | (optional)Set to false to exclude experiment batch runs.                                |
| `bucket`            | `"day" \| "week" \| "month"` | (optional)Calendar bucket size for the bar chart series. Defaults to day.               |
| `rollingWindow`     | `number`                     | (optional)Number of reviewed runs per rolling correctness point. Defaults to 100.       |
| `minRollingReviews` | `number`                     | (optional)Minimum reviewed runs required before emitting rolling points. Defaults to 1. |

**Response**

```ts
// RunReviewHealthResponse
```

### `client.runs.promote`

**`POST /api/v1/runs/:id/promote`**

Promote run to example

Turn a reviewed run into a dataset example. The new example uses the run input and any corrected output/files stored through the review endpoints.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id.     |

**Request body**

```ts
// PromoteRunRequest
```

**Response**

```ts
// PromoteRunResponse
```

### `client.runs.reviews.get`

**`GET /api/v1/runs/:id/reviews`**

Get run review

Returns review metadata and corrections for a run. Corrected files are listed at GET /runs/{id}/reviews/expected; embed review + expected artifacts with GET /runs/{id}?expand=execution.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id.     |

**Response**

```ts
// RunReviewDetail
```

### `client.runs.reviews.update`

**`PUT /api/v1/runs/:id/reviews`**

Update run review

Create or replace review metadata for a run.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id.     |

**Request body**

```ts
// RunReviewRequest
```

**Response**

```ts
// RunReviewDetail
```

### `client.runs.reviews.clear`

**`DELETE /api/v1/runs/:id/reviews`**

Clear run review

Deletes review metadata, corrections, and corrected files for the run.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id.     |

**Response**

```ts
// RunReviewDetail
```

### `client.runs.reviews.listExpected`

**`GET /api/v1/runs/:id/reviews/expected`**

List corrected files

Returns corrected artifact files attached to the run review. Review metadata and corrected JSON output live at GET /runs/{id}/reviews.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id.     |

**Response**

```ts
// RunReviewExpectedArtifacts
```

### `client.runs.reviews.copyOutputToExpected / uploadExpected`

**`POST /api/v1/runs/:id/reviews/expected`**

Add corrected file

Attach one corrected file to a run review. Send multipart/form-data with `file` and optional `name` to upload a local file, or JSON with `outputFileName` and optional `expectedName` to copy an existing run output file.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id.     |

**Request body**

```ts
// RunReviewExpectedFileCopyRequest
```

**Response**

```ts
// RunReviewExpectedFileMutationResponse
```

### `client.runs.reviews.downloadExpected`

**`GET /api/v1/runs/:id/reviews/expected/:filename`**

Download corrected artifact file

Downloads one corrected artifact file attached to the run review. Use the `filename` returned by the corrected-output collection endpoint.

**Path parameters**

| Name       | Type     | Description                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `id`       | `string` | Run id.                                                                                                 |
| `filename` | `string` | Corrected artifact file name or slash-delimited path, as returned by `GET /runs/{id}/reviews/expected`. |

**Response**

```ts
// Blob
```

### `client.runs.reviews.renameExpected`

**`PATCH /api/v1/runs/:id/reviews/expected/:filename`**

Rename corrected artifact file

Renames one corrected artifact file attached to the run review.

**Path parameters**

| Name       | Type     | Description                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `id`       | `string` | Run id.                                                                                                 |
| `filename` | `string` | Corrected artifact file name or slash-delimited path, as returned by `GET /runs/{id}/reviews/expected`. |

**Request body**

```ts
// RunReviewExpectedFileUpdateRequest
```

**Response**

```ts
// RunReviewExpectedFileUpdateResponse
```

### `client.runs.reviews.deleteExpected`

**`DELETE /api/v1/runs/:id/reviews/expected/:filename`**

Delete corrected artifact file

Deletes one corrected artifact file attached to the run review.

**Path parameters**

| Name       | Type     | Description                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `id`       | `string` | Run id.                                                                                                 |
| `filename` | `string` | Corrected artifact file name or slash-delimited path, as returned by `GET /runs/{id}/reviews/expected`. |

## Files

### `client.files.upload`

**`POST /api/v1/files`**

Upload file

Upload a reusable file that can later be referenced by run inputs or dataset examples.

**Response**

```ts
// File
```

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

### `client.files.download`

**`GET /api/v1/files/:id/content`**

Download file content

Download bytes for a reusable uploaded file.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | File id     |

## Runs

### `client.runs.list`

**`GET /api/v1/runs`**

List runs

List workflow and agent runs with cursor pagination.

**Query parameters**

| Name                  | Type     | Description                                                                                                                   |
| --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `type`                | `string` | (optional)                                                                                                                    |
| `source`              | `string` | (optional)                                                                                                                    |
| `status`              | `string` | (optional)                                                                                                                    |
| `trigger`             | `string` | (optional)                                                                                                                    |
| `triggeredBy`         | `string` | (optional)                                                                                                                    |
| `sourceRef`           | `string` | (optional)                                                                                                                    |
| `batchId`             | `string` | (optional)                                                                                                                    |
| `exampleId`           | `string` | (optional)                                                                                                                    |
| `exampleIdContains`   | `string` | (optional)                                                                                                                    |
| `from`                | `string` | (optional)                                                                                                                    |
| `to`                  | `string` | (optional)                                                                                                                    |
| `createdAfter`        | `string` | (optional)                                                                                                                    |
| `createdBefore`       | `string` | (optional)                                                                                                                    |
| `completedAfter`      | `string` | (optional)                                                                                                                    |
| `completedBefore`     | `string` | (optional)                                                                                                                    |
| `cursor`              | `string` | (optional)                                                                                                                    |
| `offset`              | `number` | (optional)                                                                                                                    |
| `limit`               | `number` | (optional)                                                                                                                    |
| `ids`                 | `string` | (optional)                                                                                                                    |
| `experiments`         | `string` | (optional)                                                                                                                    |
| `sort`                | `string` | (optional)                                                                                                                    |
| `order`               | `string` | (optional)                                                                                                                    |
| `reviewStatus`        | `string` | (optional)                                                                                                                    |
| `reviewVerdict`       | `string` | (optional)                                                                                                                    |
| `hasReview`           | `string` | (optional)                                                                                                                    |
| `noReview`            | `string` | (optional)                                                                                                                    |
| `hasCorrections`      | `string` | (optional)                                                                                                                    |
| `reviewNoteContains`  | `string` | (optional)                                                                                                                    |
| `reviewCreatedAfter`  | `string` | (optional)                                                                                                                    |
| `reviewCreatedBefore` | `string` | (optional)                                                                                                                    |
| `reviewUpdatedAfter`  | `string` | (optional)                                                                                                                    |
| `reviewUpdatedBefore` | `string` | (optional)                                                                                                                    |
| `reviewClosedAfter`   | `string` | (optional)                                                                                                                    |
| `reviewClosedBefore`  | `string` | (optional)                                                                                                                    |
| `sinceLastClosed`     | `string` | (optional)                                                                                                                    |
| `sampleRate`          | `string` | (optional)Keep runs whose `sampleRank` is below this threshold (0–1). Pages may return fewer than `limit` rows when filtered. |

**Response**

```ts
// RunsListResponse
```

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

### `client.runs.get`

**`GET /api/v1/runs/:id`**

Get a run

Fetch one run by id. By default this returns core metadata plus terminal output/error fields. Pass `?expand=input,usage,execution,debug` to include detailed sub-objects; `expand=execution` is also where embedded review and expected artifacts appear.

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

### `client.runs.artifacts.list`

**`GET /api/v1/runs/:id/artifacts`**

List run artifacts

Returns a JSON list of downloadable artifact paths for a run. Pass `zip=1` to switch the response to a ZIP download containing output files.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id      |

**Query parameters**

| Name     | Type       | Description                                                                                                                                                                               |
| -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zip`    | `"1"`      | (optional)When `1`, download output files as a ZIP instead of listing paths. Does not include trace, scores, or input — use `GET /runs/{id}/scores` and `GET /runs/{id}/trace` for those. |
| `bundle` | `"review"` | (optional)With `zip=1`, use `review` to download a ZIP with `output/` and `expected/` folders (corrected review artifacts).                                                               |
| `token`  | `string`   | (optional)Signed email download token (zip only; no Bearer required).                                                                                                                     |

**Response**

```ts
// RunArtifactsResponse
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

### `client.rerun`

**`POST /api/v1/runs/:id/rerun`**

Retry run

Start a new run using the source run input. By default the retry uses the latest automation version; pass `version=original` to pin the same source version as the original run.

**Path parameters**

| Name | Type     | Description             |
| ---- | -------- | ----------------------- |
| `id` | `string` | Source run id to retry. |

**Query parameters**

| Name                  | Type     | Description                                                                            |
| --------------------- | -------- | -------------------------------------------------------------------------------------- |
| `version`             | `string` | (optional)Version for the new run. `original` pins the source run. Defaults to latest. |
| `wait_for_completion` | `number` | (optional)Seconds to wait before returning (max 600). Omit for async.                  |

**Response**

```ts
// RunRerunResponse
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

Return low-level execution trace events for debugging one run. Workflow runs expose observability phases or step records; agent runs expose parsed trace.jsonl events. The shape is intentionally extensible, but common fields are documented.

**Path parameters**

| Name | Type     | Description |
| ---- | -------- | ----------- |
| `id` | `string` | Run id.     |

**Response**

```ts
// RunTraceResponse
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
