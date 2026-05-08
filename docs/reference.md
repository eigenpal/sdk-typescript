# @eigenpal/sdk reference

## Quick example

```ts
import { Eigenpal } from '@eigenpal/sdk';

const client = new Eigenpal({ apiKey: process.env.EIGENPAL_API_KEY });

// Run a workflow with a file input (multipart upload, no base64).
const result = await client.executions.runAndWait('extract-invoice', {
  contract: file, // File / Blob / { content, filename, mimeType }
});

console.log(result.status, result.result);
```

## Surface

```
client
├── executions
│   ├── cancel
│   ├── get
│   ├── list
│   └── runAndWait
└── workflows
    ├── get
    ├── run
    ├── versions
    └── list
```

## Client construction

```ts
import { Eigenpal } from '@eigenpal/sdk';

const client = new Eigenpal({
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

## Executions

### `client.executions.cancel`

**`POST /v1/executions/{executionId}/cancel`**

Cancel an execution

Idempotent. For executions not yet picked up by a worker (status=created/pending), transitions immediately to `cancelled`. For running/waiting executions, stamps `cancelRequestedAt` so the worker observes cancellation between step transitions. Terminal executions are a no-op.

**Path parameters**

| Name          | Type     | Description            |
| ------------- | -------- | ---------------------- |
| `executionId` | `string` | Execution id to cancel |

**Response**

```ts
// CancelExecutionResponse
```

### `client.executions.get`

**`GET /v1/executions/{executionId}`**

Get execution status

Returns the current status, completion timestamps, and (when terminal) the result or error for a single execution. Pass `includeSteps=true` for the per-step artifact payload (heavier; intended for debugging).

**Path parameters**

| Name          | Type     | Description                  |
| ------------- | -------- | ---------------------------- |
| `executionId` | `string` | Execution id (e.g. exec_xyz) |

**Query parameters**

| Name           | Type    | Description |
| -------------- | ------- | ----------- | ----------------------------------------------------------------------------------------- |
| `includeSteps` | `"true" | "false"`    | (optional)When "true", returns the full per-step execution payload instead of the summary |

**Response**

```ts
// ExecutionStatusResponse | ExecutionSummary
```

### `client.executions.list`

**`GET /v1/executions`**

List executions

Returns executions across the tenant, optionally filtered by workflow, status, date range, or eval example. Paginated.

**Query parameters**

| Name         | Type     | Description                                                                                              |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------- |
| `workflowId` | `string` | (optional)Comma-separated list of workflow ids to filter by                                              |
| `status`     | `string` | (optional)Comma-separated list of execution statuses to filter by                                        |
| `fromDate`   | `string` | (optional)ISO-8601 timestamp or relative expression (e.g. "now()-7d") for the lower bound on `createdAt` |
| `toDate`     | `string` | (optional)Upper bound on `createdAt`                                                                     |
| `exampleId`  | `string` | (optional)Filter to executions launched from a specific eval example                                     |
| `limit`      | `number` | (optional)                                                                                               |
| `offset`     | `number` | (optional)                                                                                               |

**Response**

```ts
// ListExecutionsResponse
```

## Workflows

### `client.workflows.get`

**`GET /v1/workflows/{id}`**

Get a workflow by id

Returns the workflow with its current version (definition + YAML content).

**Path parameters**

| Name | Type     | Description                  |
| ---- | -------- | ---------------------------- |
| `id` | `string` | Workflow id (e.g. wf_abc123) |

**Response**

```ts
// WorkflowSummary
```

### `client.workflows.run`

**`POST /v1/workflows/{id}/run`**

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

**`GET /v1/workflows/{id}/versions`**

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

**`GET /v1/workflows`**

List workflows

Returns workflows the API key has access to, with pagination. Use `name` for exact-match slug lookup, `search` for substring match.

**Query parameters**

| Name     | Type        | Description                                          |
| -------- | ----------- | ---------------------------------------------------- | --------------------------------- |
| `search` | `string`    | (optional)Substring match against workflow name      |
| `name`   | `string`    | (optional)Exact-match lookup by workflow name (slug) |
| `kind`   | `"workflow" | "block"`                                             | (optional)Filter by workflow kind |
| `limit`  | `number`    | (optional)Page size (max 100, default 50)            |
| `offset` | `number`    | (optional)Page offset                                |

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
