# @eigenpal/sdk

## 0.10.5

### Minor Changes

- d3a8b79: Run start types now model file inputs explicitly. SDK users can pass reusable file handles with `$fileId` or inline file bytes with `$inline`, matching the public API behavior for file-backed workflow runs.

## 0.10.3

### Patch Changes

- e48cb81: Remove `fileVerdict` from run review correction types; file correction intent is encoded via `correctedArtifactPath`.

## 0.9.0

### Minor Changes

- c35d5d4: Clean up the public runs and evaluation API surface: move workflow eval operations onto automations, expose run scores/artifacts through the unified runs API, and update CLI/SDK helpers to use the canonical routes.

  Breaking: `runs.evalResults` and `GET /api/v1/runs/{id}/eval-results` are replaced by `runs.scores` and `GET /api/v1/runs/{id}/scores`.

- 1a7b2ab: Expose canonical automation dataset example file routes in the generated SDK.

## 0.8.0

### Minor Changes

- d620a00: Expose the clean public automation API around automations, runs, files/artifacts, datasets, evaluators, experiments, evaluation results, and run promotion. This intentionally breaks the pre-v1 SDK/CLI surface that exposed workflow- and agent-specific top-level resources outside the explicit legacy compatibility routes.

  > [!WARNING]
  > **Breaking change (pre-v1).** The workflow- and agent-specific top-level
  > resources have been removed in favor of a single automation-centric surface.
  > These packages are still 0.x, so this breaking redesign ships as a `minor`
  > bump. Update your integration before upgrading.

  #### Removed
  - Top-level workflow resources, e.g. `client.workflows.*`, including
    `client.workflows.executions.runAndWait(...)` and the rest of the
    `client.workflows.executions.*` tree.
  - Top-level agent resources, e.g. `client.agents.*` (runs, reviews, traces,
    files, expected artifacts).
  - Top-level source/git resources, e.g. `client.sources.*`.

  #### New equivalents
  - **Start a run:** use `client.run('workflows.<slug>', input, options)` (and
    `client.run('agents.<slug>', ...)`). In the TypeScript SDK, `run-and-wait`
    is `client.run(target, input, { waitForCompletion })`; in the Python SDK use
    `client.run_and_wait(target, input=...)`.
  - **Browse automations** (workflows + agents): `client.automations.list()`,
    `client.automations.get(id)`, `client.automations.versions(id)`,
    `client.automations.triggers(id)`, plus
    `client.automations.dataset|examples|evaluators|experiments.*`.
  - **Inspect & control runs:** `client.runs.list()`, `client.runs.get(id)`,
    `client.runs.cancel(id)`, `client.runs.rerun(id)`, `client.runs.promote(id)`,
    `client.runs.usage(id)`, `client.runs.steps(id)`, `client.runs.events(id)`,
    and `client.runs.artifacts|eval_results|reviews|trace.*`.
  - **Manage reusable files:** `client.files.upload(...)`, `client.files.get(id)`,
    `client.files.download(id)`, `client.files.delete(id)`.

  #### Migration
  - `client.workflows.executions.runAndWait('<slug>', input)` →
    `client.run('workflows.<slug>', input, { waitForCompletion })` (TS) /
    `client.run_and_wait('workflows.<slug>', input=...)` (Python).
  - `client.workflows.executions.create('<slug>', input)` →
    `client.run('workflows.<slug>', input)`.
  - `client.agents.runs.create('<slug>', input)` →
    `client.run('agents.<slug>', input)`.
  - `client.workflows.get('<slug>')` / `client.agents.get('<slug>')` →
    `client.automations.get('workflows.<slug>')` /
    `client.automations.get('agents.<slug>')`.
  - Listing/inspecting executions previously under
    `client.workflows.executions.*` / `client.agents.runs.*` →
    `client.runs.*` (e.g. `client.runs.list()`, `client.runs.get(id)`).
  - `eigenpal runs promote` now accepts only `--name` (optional). Use
    `eigenpal runs reviews update` to set corrected JSON before promoting.
    Review and corrected-file commands work for both workflow and agent runs.

  #### DX fixes
  - `client.runs.*` read methods are now typed against the generated OpenAPI
    models; use `isRunFinished()` to narrow `run()` / `rerun()` responses before
    accessing `output`.
  - `eigenpal agents dataset push --file` accepts a `.zip` archive (matching
    `pull` output) as well as a directory.

## 0.7.2

### Minor Changes

- c5a709c: Public workflow list/detail responses include `apiEnabled` and `triggers`; run definition docs note workflow-only scope.

## 0.7.1

### Patch Changes

- 9db3f01: Expose `apiEnabled` and `triggers` on `AgentSummary` for runtime trigger projection.

## 0.7.0

### Minor Changes

- 963fd6c: Unify run detail on `GET /api/v1/runs/{id}`: return the canonical Run object directly (no `{ run: ... }` envelope) and merge expanded fields in-place via documented `expand` tokens. Remove the session-only `expand=internal` dashboard escape hatch; SDKs and CLI now use explicit expand lists.

### Patch Changes

- 12c00d8: Docs: clearer wording in the file-input and TypeScript-runtime sections. No API or behavior changes.

## 0.6.17

### Patch Changes

- 716c3cf: Update the hosted default API base URL and API-key guidance from `app.eigenpal.com` to `studio.eigenpal.com`.

## 0.6.15

### Minor Changes

- ca87265: Unify workflow and agent run starts behind the canonical `/api/v1/run/{target}` endpoint, root `eigenpal run` / `eigenpal rerun` commands, and root SDK `client.run()` / `client.rerun()` methods.

  The old nested CLI commands and SDK resource methods for starting workflow or agent runs have been removed.

## 0.6.10

### Patch Changes

- 99ca1b4: Unify agent and workflow run commands and SDK helpers on the shared `/api/v1/runs` API, including the public `client.runs` facade and regenerated SDK reference docs.

## 0.6.9

### Minor Changes

- 5e7c051: Add `observability` (phase timeline + structured failure) to workflow execution and agent run status API responses.

## 0.6.4

### Patch Changes

- c3486a5: Fix agent git cutover QA findings: dashboard runs now navigate to the created run, inbound email aliases preserve mixed-case organization qualifiers, sandbox source materializes under `/workspace/agent`, run artifact downloads use direct paths like `/files/eigenpal.lock`, wait-for-completion responses include source provenance, and CLI wait/watch commands exit nonzero for failed or cancelled runs.

## 0.6.0

### Patch Changes

- 2aeeaf2: Complete the agent Git cutover with pluralized agent CLI commands, source-ref run support, lockfile metadata, and regenerated SDK/docs surfaces.
- 2aeeaf2: Expose Git-backed agent source refs and public source automation APIs consistently across CLI docs and SDK facades.

## 0.5.9

### Major Changes

- c15ce88: Rename agent API calls to `/v1/agents` and scope execution helpers under their owning workflow or agent.

### Minor Changes

- d1d3260: `client.workflows.run` (and agent runs) now accept a Node readable stream (`fs.createReadStream('contract.pdf')`) as a file input, inferring the upload filename from the stream's path. Adds a `toFile(content, filename, mimeType?)` helper for attaching a filename to raw bytes (`Buffer`, `ArrayBuffer`, or `Blob`). Streams are drained to bytes before the request is sent, so a retried request can replay the body.

### Patch Changes

- 5909b21: Add execution-scoped agent feedback filters and expected artifact management to the API, CLI, and SDKs.
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
  (it was previously leaked via `currentVersion.definition.name`). It is
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

  `defineRoute` rejects paths that do not start with `/api/` so the
  mismatch cannot reappear by accident.

## Unreleased

- Initial release.
- Coverage: workflow trigger (sync + async), execution polling, cancel, workflow & version listing.
- `Eigenpal` facade with API key auth, automatic retries on 5xx / 429 / network errors with `Retry-After` honoring, typed `EigenpalError` subclasses, and `workflows.executions.runAndWait()` for client-side polling.
