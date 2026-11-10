import type { CreateClientConfig } from './generated/client.gen';

/**
 * Runtime configuration hook for the generated hey-api client.
 *
 * This hook only affects direct use of the generated SDK functions in
 * `@eigenpal/sdk/generated`. `EigenpalClient` in `client.ts` creates its own
 * client with `createClient(config)` and does not go through this factory.
 * The default baseUrl here is used only when a caller does not pass one.
 */
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: config?.baseUrl ?? 'https://api.eigenpal.com',
});
