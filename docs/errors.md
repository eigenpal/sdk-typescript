# Errors

## API request errors

Every non-2xx response throws a typed subclass of `EigenpalError`.

| HTTP            | Class                     | Notes                                                                |
| --------------- | ------------------------- | -------------------------------------------------------------------- |
| 400             | `EigenpalValidationError` | `.issues` carries per-field problems                                 |
| 401             | `EigenpalAuthError`       | Bad / missing API key                                                |
| 403             | `EigenpalForbiddenError`  | `api_trigger_disabled`, `manual_trigger_disabled`, or scope mismatch |
| 404             | `EigenpalNotFoundError`   | Automation / run does not exist                                      |
| 429             | `EigenpalRateLimitError`  | `.retryAfter` is the server-suggested wait (seconds)                 |
| 5xx             | `EigenpalServerError`     | Auto-retried up to `maxRetries`                                      |
| timeout / abort | `EigenpalTimeoutError`    |                                                                      |

```ts
import { EigenpalClient, EigenpalValidationError } from '@eigenpal/sdk';

try {
  await client.run('workflows.extract-invoice');
} catch (err) {
  if (err instanceof EigenpalValidationError) {
    for (const issue of err.issues) {
      console.error(`${issue.field}: ${issue.message}`);
    }
  }
  throw err;
}
```

## Retries

The SDK retries on `5xx`, `429` (honoring `Retry-After`), and network errors. 4xx errors are surfaced immediately as typed exceptions. Configure via `maxRetries`:

```ts
new EigenpalClient({ maxRetries: 3 }); // default
```

Backoff is exponential (250ms, 500ms, 1s, 2s) unless the server returns `Retry-After`.

## Request id

Every error carries `requestId` from the server's response header. Forward it to support for fastest triage:

```ts
catch (err) {
  if (err instanceof EigenpalError) {
    log.error({ requestId: err.requestId, status: err.status }, err.message);
  }
}
```

## Bad baseUrl

If `baseUrl` points at a non-API host (the marketing site, a misconfigured proxy), the SDK throws `EigenpalError` with a clear message instead of returning HTML or surfacing a downstream JSON-parse crash. Set `baseUrl` to your EigenPal instance root.

## Run failures are returned data

A successful API call can return a failed run. HTTP 200 means the request
succeeded, not that processing succeeded. `finished: true` means the run is
terminal, including failure and cancellation. Inspect `execution.status`.

A failed run's `error` is an object with `code`, `message`, and `retryable`.
A deliberate `control.fail` rejection also includes `statusCode` (for example 422) and `step`. That business code is not the HTTP response status.
`retryable` describes potential recovery; it does not schedule another run.
The SDK does not throw an HTTP exception or automatically rerun a workflow
because a successful response contains a failed run.

Run errors were previously strings. Display `error.message` after updating
clients. Historical failures without retained typed metadata have
`code: "unknown_error"` and no business `statusCode`.

See [Errors and recovery](https://docs.eigenpal.com/guides/errors) for the API
issue codes, run failure codes, examples, retry policies, and legacy endpoints.

```ts
const run = await client.runs.get(runId);
if (run.execution.status === 'failed' && run.error) {
  console.error(run.error.code, run.error.statusCode, run.error.message);
}
```
