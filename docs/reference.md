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
│   ├── executions.list
│   ├── executions.get
│   └── executions.cancel
└── workflows
    ├── list
    ├── get
    ├── run
    ├── versions
    ├── executions.list
    ├── executions.get
    ├── executions.cancel
    └── executions.runAndWait
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

### `client.agents.executions.list`

**`GET /api/v1/agents/{agentId}/executions`**

List agent executions

Returns executions for an agent, optionally filtered by status or experiment batch.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Query parameters**

| Name      | Type     | Description                          |
| --------- | -------- | ------------------------------------ |
| `status`  | `string` | (optional)Execution status filter    |
| `batchId` | `string` | (optional)Experiment batch id filter |
| `limit`   | `number` | (optional)                           |
| `offset`  | `number` | (optional)                           |

**Response**

```ts
// ListAgentExecutionsResponse
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

Execute an agent

Enqueues an agent execution. Returns 202 with `{ executionId }` by default. Pass `wait_for_completion=<seconds>` to hold the connection until the execution reaches a terminal state. File inputs are uploaded as multipart/form-data.

**Path parameters**

| Name      | Type     | Description      |
| --------- | -------- | ---------------- |
| `agentId` | `string` | Agent id or slug |

**Query parameters**

| Name                  | Type     | Description                                                                                |
| --------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `wait_for_completion` | `number` | (optional)Seconds to hold the connection waiting for completion (max 600). Omit for async. |

**Request body**

```ts
// RunAgentBody
```

**Response**

```ts
// RunAgentResponse
```

### `client.agents.executions.cancel`

**`POST /api/v1/agents/executions/{executionId}/cancel`**

Cancel agent execution

Requests cancellation for one agent execution by id.

**Path parameters**

| Name          | Type     | Description  |
| ------------- | -------- | ------------ |
| `executionId` | `string` | Execution id |

**Response**

```ts
// CancelAgentExecutionResponse
```

### `client.agents.executions.get`

**`GET /api/v1/agents/executions/{executionId}`**

Get agent execution

Returns one agent execution by id.

**Path parameters**

| Name          | Type     | Description  |
| ------------- | -------- | ------------ |
| `executionId` | `string` | Execution id |

**Query parameters**

| Name      | Type     | Description                                             |
| --------- | -------- | ------------------------------------------------------- |
| `include` | `string` | (optional)Comma-separated optional sections, e.g. files |

**Response**

```ts
// AgentExecutionResponse
```

### `client.agents.list`

**`GET /api/v1/agents`**

List agents

Returns agents the API key has access to, with pagination and basic execution stats.

**Query parameters**

| Name     | Type     | Description                                    |
| -------- | -------- | ---------------------------------------------- |
| `search` | `string` | (optional)Substring match against agent fields |
| `limit`  | `number` | (optional)                                     |
| `offset` | `number` | (optional)                                     |

**Response**

```ts
// ListAgentsResponse
```

### `client.agents.create`

**`POST /api/v1/agents`**

Create an agent

Creates a new agent and initializes its workspace files.

**Request body**

```ts
// CreateAgentBody
```

**Response**

```ts
// CreateAgentResponse
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

| Name           | Type    | Description |
| -------------- | ------- | ----------- | ----------------------------------------------------------------------------------------- |
| `includeSteps` | `"true" | "false"`    | (optional)When "true", returns the full per-step execution payload instead of the summary |

**Response**

```ts
// WorkflowExecutionStatusResponse | ExecutionSummary
```

### `client.workflows.list`

**`GET /api/v1/workflows`**

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
