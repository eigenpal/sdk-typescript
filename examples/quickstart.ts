/**
 * Run with: `EIGENPAL_API_KEY=eg_… bun examples/quickstart.ts`
 *
 * Lists workflows, picks the first one, triggers a run, and polls until the
 * execution reaches a terminal state.
 */
import { Eigenpal, EigenpalError } from '../src';

async function main() {
  const client = new Eigenpal({
    apiKey: process.env.EIGENPAL_API_KEY,
    baseUrl: process.env.EIGENPAL_BASE_URL, // for self-hosted; defaults to cloud
  });

  const { data: workflows } = await client.workflows.list({ limit: 1 });
  if (workflows.length === 0) {
    console.log('No workflows yet. Create one in the dashboard, then re-run.');
    return;
  }
  const workflow = workflows[0];
  console.log(`Triggering ${workflow.id} (${workflow.currentVersion?.definition})`);

  const result = await client.executions.runAndWait(
    workflow.id,
    /* inputs: */ {},
    { timeoutMs: 5 * 60_000 }
  );

  console.log('status:', result.status);
  console.log('result:', JSON.stringify(result.result, null, 2));
}

main().catch((err) => {
  if (err instanceof EigenpalError) {
    console.error(`✗ ${err.name} (${err.status}): ${err.message}`);
    if (err.envelope) console.error(JSON.stringify(err.envelope, null, 2));
  } else {
    console.error(err);
  }
  process.exit(1);
});
