import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Configuration for `@hey-api/openapi-ts`.
 *
 * Reads the canonical OpenAPI spec emitted by `packages/app/scripts/build-openapi.ts`
 * and emits a typed SDK into `src/generated/`. The hand-written `Eigenpal`
 * facade in `src/client.ts` wraps the generated per-operation functions.
 *
 * The generated files are committed and shipped as part of the published
 * tarball — they are NOT regenerated on the user's machine.
 */
export default defineConfig({
  input: '../app/openapi/openapi.yaml',
  output: {
    path: './src/generated',
    format: 'prettier',
    lint: false,
  },
  plugins: [
    {
      name: '@hey-api/client-fetch',
      runtimeConfigPath: './src/runtime-config.ts',
    },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
