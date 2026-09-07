import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EigenpalClient } from '../src';
import type {
  CreateEmailServerRequest,
  EmailServer,
  ListEmailServersResponse,
  TestEmailServerRequest,
  TestEmailServerResponse,
} from '../src/generated/types.gen';

const SERVER_ID = 'ems_01ABCDEFGHJKMNPQRSTVWXYZ';

function publicResendServer(
  overrides: Partial<Extract<EmailServer, { transport: 'resend' }>> = {}
): EmailServer {
  return {
    id: SERVER_ID,
    name: 'Alerts',
    enabled: true,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
    transport: 'resend',
    fromEmail: 'alerts@example.com',
    fromName: 'EigenPal',
    apiKeyConfigured: true,
    ...overrides,
  };
}

function publicSmtpServer(): EmailServer {
  return {
    id: SERVER_ID,
    name: 'SMTP Alerts',
    enabled: true,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
    transport: 'smtp',
    fromEmail: 'alerts@example.com',
    fromName: 'EigenPal',
    host: 'smtp.example.com',
    port: 587,
    security: 'starttls',
    username: 'mailer',
    passwordConfigured: true,
    caPemConfigured: false,
  };
}

function assertNoSecrets(value: unknown): void {
  const json = JSON.stringify(value);
  expect(json).not.toContain('"apiKey"');
  expect(json).not.toContain('"password"');
  expect(json).not.toContain('"caPem"');
  expect(json).not.toContain('re_test_secret');
}

describe('emailServers resource', () => {
  test('lists with OpenAPI pagination query and typed public rows', async () => {
    const requests: Request[] = [];
    const listing: ListEmailServersResponse = {
      data: [publicResendServer(), publicSmtpServer()],
      total: 2,
      limit: 20,
      offset: 10,
    };
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        return Response.json(listing);
      }) as typeof globalThis.fetch,
    });

    const page = await client.emailServers.list({ limit: 20, offset: 10 });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe('GET');
    expect(new URL(requests[0]!.url).pathname).toBe('/v1/email-servers');
    expect(new URL(requests[0]!.url).searchParams.get('limit')).toBe('20');
    expect(new URL(requests[0]!.url).searchParams.get('offset')).toBe('10');
    expect(page).toEqual(listing);
    expect(page.data[0]).toMatchObject({ transport: 'resend', apiKeyConfigured: true });
    expect(page.data[1]).toMatchObject({
      transport: 'smtp',
      passwordConfigured: true,
      caPemConfigured: false,
    });
    assertNoSecrets(page);
  });

  test('create/get/update/delete/test match verbs, bodies, and public responses', async () => {
    const requests: Request[] = [];
    const createBody: CreateEmailServerRequest = {
      name: 'Alerts',
      transport: 'resend',
      apiKey: 're_test_secret',
      fromEmail: 'alerts@example.com',
      fromName: 'EigenPal',
    };
    const testBody: TestEmailServerRequest = { to: 'ops@example.com' };
    const testResult: TestEmailServerResponse = {
      ok: true,
      transport: 'resend',
      messageId: 'msg_1',
    };

    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        if (request.method === 'POST' && request.url.endsWith('/v1/email-servers')) {
          return Response.json(publicResendServer(), { status: 201 });
        }
        if (request.method === 'GET' && request.url.endsWith(`/v1/email-servers/${SERVER_ID}`)) {
          return Response.json(publicResendServer());
        }
        if (request.method === 'PATCH' && request.url.endsWith(`/v1/email-servers/${SERVER_ID}`)) {
          return Response.json(publicResendServer({ name: 'Renamed' }));
        }
        if (request.method === 'DELETE' && request.url.endsWith(`/v1/email-servers/${SERVER_ID}`)) {
          return Response.json({ deleted: true, id: SERVER_ID });
        }
        if (
          request.method === 'POST' &&
          request.url.endsWith(`/v1/email-servers/${SERVER_ID}/test`)
        ) {
          return Response.json(testResult);
        }
        throw new Error(`Unexpected ${request.method} ${request.url}`);
      }) as typeof globalThis.fetch,
    });

    const created = await client.emailServers.create(createBody);
    const fetched = await client.emailServers.get(SERVER_ID);
    const updated = await client.emailServers.update(SERVER_ID, {
      name: 'Renamed',
      enabled: true,
    });
    const deleted = await client.emailServers.delete(SERVER_ID);
    const tested = await client.emailServers.test(SERVER_ID, testBody);

    expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      ['POST', '/v1/email-servers'],
      ['GET', `/v1/email-servers/${SERVER_ID}`],
      ['PATCH', `/v1/email-servers/${SERVER_ID}`],
      ['DELETE', `/v1/email-servers/${SERVER_ID}`],
      ['POST', `/v1/email-servers/${SERVER_ID}/test`],
    ]);
    expect(await requests[0]!.json()).toEqual(createBody);
    expect(await requests[2]!.json()).toEqual({ name: 'Renamed', enabled: true });
    expect(await requests[4]!.json()).toEqual(testBody);

    expect(created).toEqual(publicResendServer());
    expect(fetched.id).toBe(SERVER_ID);
    expect(updated.name).toBe('Renamed');
    expect(deleted).toEqual({ deleted: true, id: SERVER_ID });
    expect(tested).toEqual(testResult);
    expect('to' in tested).toBe(false);
    assertNoSecrets(created);
    assertNoSecrets(fetched);
    assertNoSecrets(updated);
    assertNoSecrets(tested);
  });

  test('forwards AbortSignal on list and test', async () => {
    const controller = new AbortController();
    const signals: Array<AbortSignal | null> = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        signals.push(request.signal);
        if (request.url.includes('/test')) {
          return Response.json({ ok: false, error: 'provider_failed' });
        }
        return Response.json({ data: [], total: 0, limit: 20, offset: 0 });
      }) as typeof globalThis.fetch,
    });

    await client.emailServers.list({ signal: controller.signal });
    await client.emailServers.test(
      SERVER_ID,
      { to: 'ops@example.com' },
      { signal: controller.signal }
    );
    expect(signals).toHaveLength(2);
    expect(signals[0]).toBe(controller.signal);
    expect(signals[1]).toBe(controller.signal);
  });

  test('public facade and generated docs cover email server methods', () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: (async () => new Response('{}')) as typeof globalThis.fetch,
      maxRetries: 0,
    });
    expect(typeof client.emailServers.list).toBe('function');
    expect(typeof client.emailServers.get).toBe('function');
    expect(typeof client.emailServers.create).toBe('function');
    expect(typeof client.emailServers.update).toBe('function');
    expect(typeof client.emailServers.delete).toBe('function');
    expect(typeof client.emailServers.test).toBe('function');

    const docs = readFileSync(join(import.meta.dir, '../docs/reference.md'), 'utf8');
    expect(docs).toContain('### `client.emailServers.list`');
    expect(docs).toContain('### `client.emailServers.create`');
    expect(docs).toContain('### `client.emailServers.get`');
    expect(docs).toContain('### `client.emailServers.update`');
    expect(docs).toContain('### `client.emailServers.delete`');
    expect(docs).toContain('### `client.emailServers.test`');
    expect(docs).toContain('limit');
    expect(docs).toContain('offset');
    expect(docs).toContain("{ to: 'ops@example.com' }");
  });
});
