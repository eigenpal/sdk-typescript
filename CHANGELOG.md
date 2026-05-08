# @eigenpal/sdk

## 0.4.10

- Initial release.
- Coverage: workflow trigger (sync + async), execution polling, cancel, workflow & version listing.
- `Eigenpal` facade with API key auth, automatic retries on 5xx / 429 / network errors with `Retry-After` honoring, typed `EigenpalError` subclasses, and `executions.runAndWait()` for client-side polling.
