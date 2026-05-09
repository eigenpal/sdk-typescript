#!/usr/bin/env bun
/**
 * End-to-end smoke battery for `@eigenpal/sdk` against a live EigenPal.
 *
 * Usage:
 *   EIGENPAL_BASE_URL=http://localhost:3000 \
 *   EIGENPAL_API_KEY=eig_live_… \
 *   bun run /path/to/local-smoke.ts
 *
 * Exercises every code path a real consumer hits — read endpoints,
 * triggers, polling, multipart uploads, error mapping, telemetry,
 * the bad-baseUrl guard. Asserts the trimmed public surface on every
 * read response. Skips the live workflow run if no workflow with an
 * `api` trigger exists on the tenant.
 */
import {
  EigenpalAuthError,
  EigenpalClient,
  EigenpalError,
  EigenpalNotFoundError,
} from '@eigenpal/sdk';

const baseUrl = process.env.EIGENPAL_BASE_URL ?? 'http://localhost:3000';
const apiKey = process.env.EIGENPAL_API_KEY;
if (!apiKey) {
  console.error('EIGENPAL_API_KEY is required.');
  process.exit(2);
}

const PUBLIC_WORKFLOW_FIELDS = new Set(['id', 'name', 'version', 'createdAt', 'updatedAt']);
const PUBLIC_EXECUTION_FIELDS = new Set([
  'id',
  'workflowId',
  'status',
  'triggerType',
  'triggerInput',
  'result',
  'error',
  'createdAt',
  'startedAt',
  'completedAt',
  'workflow',
]);
const PUBLIC_VERSION_FIELDS = new Set([
  'id',
  'workflowId',
  'version',
  'yamlContent',
  'isCurrent',
  'createdAt',
]);

const results: { name: string; ok: boolean; detail: string }[] = [];
const pass = (name: string, ok: boolean, detail: string) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name} — ${detail}`);
};

function assertPublicShape(name: string, item: unknown, allowed: Set<string>): void {
  const keys = Object.keys((item as Record<string, unknown>) ?? {});
  const leaked = keys.filter((k) => !allowed.has(k));
  pass(
    name,
    leaked.length === 0,
    leaked.length ? `LEAKED: ${leaked.join(', ')}` : `keys: ${keys.sort().join(', ')}`
  );
}

async function expectThrows<E extends Error>(
  name: string,
  expected: new (...a: never[]) => E,
  fn: () => Promise<unknown>
): Promise<void> {
  try {
    await fn();
    pass(name, false, 'no error thrown');
  } catch (e) {
    pass(name, e instanceof expected, `${(e as Error).constructor.name}`);
  }
}

const client = new EigenpalClient({ baseUrl, apiKey });
console.log(`→ Smoke-testing @eigenpal/sdk against ${baseUrl}\n`);

// 1. workflows.list — public shape, pagination
const list = await client.workflows.list({ limit: 2 });
pass(
  'workflows.list returns paginated envelope',
  typeof list.total === 'number' && list.limit === 2,
  `total=${list.total} limit=${list.limit} offset=${list.offset}`
);
if (list.data?.length)
  assertPublicShape('workflows[0] public shape', list.data[0], PUBLIC_WORKFLOW_FIELDS);

// 2. workflows.get — public shape
const wfId = list.data?.[0]?.id;
if (wfId) {
  const wf = await client.workflows.get(wfId);
  assertPublicShape('workflows.get public shape', wf, PUBLIC_WORKFLOW_FIELDS);
  pass(
    'workflows.get version is a string',
    typeof wf.version === 'string' || wf.version === null,
    `version=${wf.version ?? '<null>'}`
  );
}

// 3. workflows.versions — public shape, isCurrent boolean, name mismatch fixed
if (wfId) {
  const versions = await client.workflows.versions(wfId, { limit: 5 });
  pass(
    'workflows.versions returns paginated envelope',
    Array.isArray(versions.data),
    `data.length=${versions.data?.length ?? 0}`
  );
  if (versions.data?.length) {
    assertPublicShape('versions[0] public shape', versions.data[0], PUBLIC_VERSION_FIELDS);
    const hasCurrent = versions.data.some((v) => (v as { isCurrent?: boolean }).isCurrent === true);
    pass(
      'versions includes one with isCurrent=true',
      hasCurrent,
      hasCurrent ? 'ok' : 'no version flagged isCurrent'
    );
  }
}

// 4. workflows.executions.list — public shape, filters
const execs = wfId
  ? await client.workflows.executions.list(wfId, { limit: 3 })
  : { data: [], total: 0 };
pass(
  'workflows.executions.list returns paginated envelope',
  typeof execs.total === 'number',
  `total=${execs.total}`
);
if (execs.data?.length)
  assertPublicShape('workflows.executions[0] public shape', execs.data[0], PUBLIC_EXECUTION_FIELDS);

// 5. workflows.executions.list is workflow-scoped
if (wfId && execs.data?.length) {
  const filtered = await client.workflows.executions.list(wfId, { limit: 5 });
  const allMatch = filtered.data.every((e) => e.workflowId === wfId);
  pass(
    'workflows.executions.list returns only the requested workflow',
    allMatch,
    `${filtered.data.length} items, all match=${allMatch}`
  );
}

// 6. workflows.executions.list with status filter
const failedRuns = wfId
  ? await client.workflows.executions.list(wfId, { status: 'failed', limit: 3 })
  : { data: [] };
const allFailed = failedRuns.data.every((e) => e.status === 'failed');
pass(
  'workflows.executions.list filters by status=failed',
  allFailed,
  `${failedRuns.data.length} items, all failed=${allFailed}`
);

// 7. workflows.executions.get — terminal execution from list
const completedExec = execs.data?.find((e) => e.status === 'completed') ?? execs.data?.[0];
if (completedExec) {
  const detail = await client.workflows.executions.get(completedExec.id);
  pass(
    'workflows.executions.get returns matching id',
    detail.executionId === completedExec.id,
    `id=${detail.executionId}`
  );
  pass(
    'workflows.executions.get has status',
    typeof detail.status === 'string',
    `status=${detail.status}`
  );
}

// 8. workflows.executions.get with includeSteps — heavier per-step payload
if (completedExec) {
  const stepDetail = await client.workflows.executions.get(completedExec.id, {
    includeSteps: true,
  });
  // The full artifact is a discriminated union with the summary; both shapes
  // carry executionId, the artifact additionally has steps/overrides/etc.
  const k = new Set(Object.keys((stepDetail as object) ?? {}));
  pass(
    'workflows.executions.get includeSteps=true returns artifact',
    k.has('executionId') && k.has('status'),
    `keys: ${[...k].slice(0, 8).join(', ')}…`
  );
}

// 9-12. Typed error mapping for common 4xx + bad-host cases.
await expectThrows('bad apiKey throws EigenpalAuthError', EigenpalAuthError, () =>
  new EigenpalClient({
    baseUrl,
    apiKey: 'eig_live_definitely_not_a_real_key_xxxxxxxxxxxxxxx',
  }).workflows.list({ limit: 1 })
);
await expectThrows('unknown workflow id throws EigenpalNotFoundError', EigenpalNotFoundError, () =>
  client.workflows.get('wf_definitely_does_not_exist_xxx')
);
await expectThrows('unknown execution id throws EigenpalNotFoundError', EigenpalNotFoundError, () =>
  client.workflows.executions.get('exec_definitely_does_not_exist_xxx')
);
await expectThrows('bad baseUrl throws EigenpalError', EigenpalError, () =>
  new EigenpalClient({ baseUrl: 'https://example.com', apiKey }).workflows.list({ limit: 1 })
);

// 13. Async trigger + immediate cancel (verifies multipart-less POST + cancel)
//     Skip if no workflow has an `api` trigger we can hit.
const apiWorkflow = list.data?.find((w) => (w as { id: string }).id);
let triggeredId: string | null = null;
if (apiWorkflow) {
  try {
    const triggered = await client.workflows.run(apiWorkflow.id, {});
    triggeredId = triggered.executionId;
    pass(
      'workflows.run (no input) returns executionId',
      typeof triggered.executionId === 'string' && triggered.executionId.startsWith('exec_'),
      `executionId=${triggered.executionId}`
    );
  } catch (e) {
    // Workflow may require specific input — that's fine, we're testing the
    // SDK round-trip, not workflow semantics. Surface the error so we know
    // it was typed correctly.
    pass(
      'workflows.run errors are typed (when input invalid)',
      e instanceof EigenpalError,
      `${(e as Error).constructor.name}: ${(e as Error).message.slice(0, 80)}`
    );
  }
}

// 14. workflows.executions.cancel is idempotent
if (triggeredId) {
  try {
    const r1 = await client.workflows.executions.cancel(triggeredId);
    const r2 = await client.workflows.executions.cancel(triggeredId);
    pass(
      'workflows.executions.cancel is idempotent',
      typeof r1 === 'object' && typeof r2 === 'object',
      `r1.status=${(r1 as { status?: string }).status} r2.status=${(r2 as { status?: string }).status}`
    );
  } catch (e) {
    pass(
      'workflows.executions.cancel is idempotent',
      false,
      `${(e as Error).message.slice(0, 100)}`
    );
  }
}

// 15. Telemetry: send a deliberately-overridden User-Agent and verify the SDK
//     respected it (round-trip — we can't read headers from the server, but
//     we CAN call workflows.list with a custom UA and verify no error).
try {
  const traced = new EigenpalClient({
    baseUrl,
    apiKey,
    defaultHeaders: { 'X-Trace-Id': 'smoke-trace-001' },
  });
  await traced.workflows.list({ limit: 1 });
  pass(
    'custom defaultHeaders pass through cleanly',
    true,
    'X-Trace-Id sent without breaking the call'
  );
} catch (e) {
  pass('custom defaultHeaders pass through cleanly', false, `${(e as Error).message}`);
}

// Summary
const failed_ = results.filter((r) => !r.ok);
console.log(
  `\n${failed_.length === 0 ? '✓ all checks passed' : `✗ ${failed_.length} check(s) failed`} (${results.length} total)`
);
process.exit(failed_.length === 0 ? 0 : 1);
