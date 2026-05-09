# Configuration

```ts
new EigenpalClient({
  apiKey: 'eg_...', // or EIGENPAL_API_KEY env var
  baseUrl: 'https://app.eigenpal.com', // or EIGENPAL_BASE_URL env var
  timeoutMs: 60_000, // per-request timeout
  maxRetries: 3, // 5xx / 429 / network
  defaultHeaders: { 'X-Trace-Id': '...' }, // merged into every request
  fetch: customFetch, // override the global fetch (testing)
});
```

## API key

`apiKey` always wins. If omitted, the SDK reads `EIGENPAL_API_KEY` from the environment. If neither is set, the constructor throws.

Issue keys from the dashboard under **Settings → API Keys**. Keep them in env vars or a secret manager; never check them into git.

## Self-hosted

Point at your own deployment via `baseUrl`:

```ts
new EigenpalClient({
  baseUrl: process.env.EIGENPAL_BASE_URL ?? 'https://eigenpal.acme.internal',
});
```

`baseUrl` overrides `EIGENPAL_BASE_URL`. Defaults to `https://app.eigenpal.com`.

## Timeouts

`timeoutMs` applies per-request. The per-call `signal` (an `AbortSignal`) wins if you pass one.

For workflow runs longer than `timeoutMs`, prefer `workflows.executions.runAndWait` (client-side polling) over `workflows.run({ waitForCompletion })` (server-side hold).

## Custom headers

`defaultHeaders` is merged into every outgoing request. Useful for tracing, custom user-agent suffixes, or anything else your infrastructure needs:

```ts
new EigenpalClient({
  defaultHeaders: {
    'X-Trace-Id': traceId(),
    'X-Service': 'invoice-pipeline',
  },
});
```

## Custom fetch

Inject a mock or alternative HTTP client for testing:

```ts
import { fetch as undiciFetch } from 'undici';
new EigenpalClient({ fetch: undiciFetch });
```

## TypeScript runtime

The package ships TypeScript source (`./src/index.ts` is the entry point). You'll need a TypeScript-aware runtime: Bun, Deno, Node + `ts-node` / `tsx`, Next.js, Vite, Webpack with `ts-loader`, or any modern bundler. Plain `node ./script.js` won't load it. That's intentional: shipping TS-first keeps the source debuggable end-to-end.
