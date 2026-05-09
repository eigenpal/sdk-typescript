/**
 * Run with: `EIGENPAL_API_KEY=eg_… bun examples/quickstart.ts`
 *
 * Lists workflows, picks the first one, triggers a run, and polls until the
 * execution reaches a terminal state.
 */
import { EigenpalClient, EigenpalError } from '../src';

async function main() {
  const client = new EigenpalClient({
    // eslint-disable-next-line no-process-env
    apiKey: process.env.EIGENPAL_API_KEY,
    // eslint-disable-next-line no-process-env
    baseUrl: process.env.EIGENPAL_BASE_URL, // for self-hosted; defaults to cloud
  });

  const { data: workflows } = await client.workflows.list({ limit: 1 });
  if (workflows.length === 0) {
    console.log('No workflows yet. Create one in the dashboard, then re-run.');
    return;
  }
  const workflow = workflows[0];
  console.log(`Triggering ${workflow.id} @ version ${workflow.version ?? '<unreleased>'}`);

  const result = await client.workflows.executions.runAndWait(
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
