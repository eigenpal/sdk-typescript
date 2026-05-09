# Errors

Every non-2xx response throws a typed subclass of `EigenpalError`.

| HTTP            | Class                     | Notes                                                |
| --------------- | ------------------------- | ---------------------------------------------------- |
| 400             | `EigenpalValidationError` | `.issues` carries per-field problems                 |
| 401             | `EigenpalAuthError`       | Bad / missing API key                                |
| 403             | `EigenpalForbiddenError`  | API trigger disabled, scope mismatch                 |
| 404             | `EigenpalNotFoundError`   | Workflow / execution doesn't exist                   |
| 429             | `EigenpalRateLimitError`  | `.retryAfter` is the server-suggested wait (seconds) |
| 5xx             | `EigenpalServerError`     | Auto-retried up to `maxRetries`                      |
| timeout / abort | `EigenpalTimeoutError`    |                                                      |

```ts
import { EigenpalClient, EigenpalValidationError } from '@eigenpal/sdk';

try {
  await client.workflows.run('extract-invoice');
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
