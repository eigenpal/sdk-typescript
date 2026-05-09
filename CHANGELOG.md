# @eigenpal/sdk

## 0.4.12

### Major Changes

- c15ce88: Rename agent API calls to `/v1/agents` and scope execution helpers under their owning workflow or agent.

### Patch Changes

- 9905f7f: Fix the published SDKs so the README's default `baseUrl` works. 0.4.10
  shipped paths under `/v1/...` while the actual Next.js routes live at
  `/api/v1/...`, so every call from a freshly installed SDK either hit
  the marketing-site HTML (200 OK silently parsed as a workflow object)
  or 307'd to a redirect Python wouldn't follow. Now the OpenAPI spec
  emits `/api/v1/...` and the regenerated TS + Python clients call the
  real URLs without a `baseUrl: '.../api'` workaround.

  Also trims the v1 public surface so SDK consumers no longer see internal
  columns. The legacy app handlers spread the raw DB row, which dragged
  `tenantId`, `isBlock`, `currentHistoryId`, `evalConfigYaml`, `createdBy`,
  the full `currentVersion` object, `traceId`, `spanId`, `versionId`,
  `leaseId`, `workerId`, `definitionSnapshot`, `blockSnapshots`,
  `stepResults`, `evalScore`, `priority`, retry-chain pointers, etc. into
  typed SDK output. The v1 endpoints now wrap the legacy response with
  `pickPublicWorkflow` / `pickPublicWorkflowVersion` / `pickPublicExecution`
  helpers (forwarded via `forwardItem` / `forwardList`), so the wire shape
  matches the schema. `WorkflowSummary` is now
  `{ id, version, createdAt, updatedAt }` — `version` is the release tag
  string callers actually want, replacing the internal `currentHistoryId`.

  Heads-up: workflow `name` is no longer surfaced as a top-level field
  (it was previously leaked via `currentVersion.definition.name`). It's
  authoritative inside the YAML, so fetch it via
  `client.workflows.versions(id)[0].yamlContent` and parse, or treat the
  workflow `id` as the canonical identifier.

  Tightens response handling on both sides: the client throws
  `EigenpalError` whenever a response carries a non-JSON Content-Type
  (2xx or 4xx), so the next misconfigured `baseUrl` fails loudly with a
  "point baseUrl at your EigenPal instance root" message instead of
  silently returning string-as-object or surfacing a downstream
  `JSONDecodeError`.

  Renames the constructor: `Eigenpal` → `EigenpalClient` in both SDKs.
  The old name was ambiguous when imported alongside `EigenpalError` etc.
  and read awkwardly as `new Eigenpal(...)` next to the brand
  ("Eigenpal"); `EigenpalClient` matches the convention of every
  neighbouring class. No backwards-compat alias since 0.4.10 is fresh.

  Adds `bun sdk:smoke:local [ts|py|both]` — packs the local SDK as the
  exact tarball / wheel that ships, installs into a clean tmp workspace,
  and runs an end-to-end smoke against `EIGENPAL_BASE_URL`. Verifies the
  v1 paths resolve, the trimmed public shape is enforced on the wire,
  and the HTML-host guard fires.

  `defineRoute` rejects paths that don't start with `/api/` so the
  mismatch can't reappear by accident.

## Unreleased

- Initial release.
- Coverage: workflow trigger (sync + async), execution polling, cancel, workflow & version listing.
- `Eigenpal` facade with API key auth, automatic retries on 5xx / 429 / network errors with `Retry-After` honoring, typed `EigenpalError` subclasses, and `workflows.executions.runAndWait()` for client-side polling.
