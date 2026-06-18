/**
 * Run with: `EIGENPAL_API_KEY=eig_live_… bun examples/quickstart.ts`
 *
 * Lists automations, picks the first one, triggers a run, and waits until the
 * run reaches a terminal state.
 */
import { EigenpalClient, EigenpalError } from '../src';

async function main() {
  const client = new EigenpalClient({
    // eslint-disable-next-line no-process-env
    apiKey: process.env.EIGENPAL_API_KEY,
    // eslint-disable-next-line no-process-env
    baseUrl: process.env.EIGENPAL_BASE_URL, // for self-hosted; defaults to cloud
  });

  const { data: automations } = await client.automations.list({ limit: 1 });
  if (automations.length === 0) {
    console.log('No automations yet. Create one in the dashboard, then re-run.');
    return;
  }
  const automation = automations[0];
  console.log(`Triggering ${automation.type} ${automation.slug} (${automation.id})`);

  const result = await client.run(
    { type: automation.type, slug: automation.slug },
    /* input: */ {},
    { waitForCompletion: 300 }
  );

  console.log('finished:', result.finished);
  if (result.finished) {
    console.log('output:', JSON.stringify(result.output, null, 2));
  } else {
    console.log(
      `Run ${result.id} still in flight; fetch it later with client.runs.get('${result.id}').`
    );
  }
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
