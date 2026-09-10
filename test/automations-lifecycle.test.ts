import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EigenpalClient, EigenpalNotFoundError, EigenpalValidationError } from '../src';
import type { AutomationDetail, ListAutomationsResponse } from '../src/generated/types.gen';

const WORKFLOW_ID = 'wf_01ABCDEFGHJKMNPQRSTVWXYZ';
const FOLDER_ID = 'fldr_01ABCDEFGHJKMNPQRSTVWXYZ';

function workflowAutomation(overrides: Partial<AutomationDetail> = {}): AutomationDetail {
  return {
    id: WORKFLOW_ID,
    type: 'workflow',
    slug: 'extract-invoice',
    name: 'extract-invoice',
    folderId: FOLDER_ID,
    folderPath: 'billing/invoices',
    createdAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('automations lifecycle', () => {
  test('list encodes folderId query including root sentinel', async () => {
    const requests: Request[] = [];
    const listing: ListAutomationsResponse = {
      data: [workflowAutomation({ folderId: null, folderPath: null })],
      total: 1,
      limit: 20,
      offset: 0,
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

    const page = await client.automations.list({
      type: 'workflow',
      folderId: 'null',
      limit: 20,
    });
    expect(requests[0]!.method).toBe('GET');
    expect(new URL(requests[0]!.url).pathname).toBe('/v1/automations');
    expect(new URL(requests[0]!.url).searchParams.get('type')).toBe('workflow');
    expect(new URL(requests[0]!.url).searchParams.get('folderId')).toBe('null');
    expect(new URL(requests[0]!.url).searchParams.get('limit')).toBe('20');
    expect(page.data[0]?.folderId).toBeNull();
    expect(page.data[0]?.folderPath).toBeNull();
  });

  test('move sends PATCH body for folderId and folderPath', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        const body = (await request.clone().json()) as {
          folderId?: string | null;
          folderPath?: string;
        };
        return Response.json(
          workflowAutomation({
            folderId: body.folderId === undefined ? FOLDER_ID : body.folderId,
            folderPath:
              body.folderPath === '/' || body.folderId === null ? null : 'billing/invoices',
          })
        );
      }) as typeof globalThis.fetch,
    });

    const byPath = await client.automations.move('workflows.extract-invoice', {
      folderPath: 'billing/invoices',
    });
    const byId = await client.automations.move(WORKFLOW_ID, { folderId: FOLDER_ID });
    const toRoot = await client.automations.move(WORKFLOW_ID, { folderId: null });

    expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      ['PATCH', '/v1/automations/workflows.extract-invoice'],
      ['PATCH', `/v1/automations/${WORKFLOW_ID}`],
      ['PATCH', `/v1/automations/${WORKFLOW_ID}`],
    ]);
    expect(await requests[0]!.json()).toEqual({ folderPath: 'billing/invoices' });
    expect(await requests[1]!.json()).toEqual({ folderId: FOLDER_ID });
    expect(await requests[2]!.json()).toEqual({ folderId: null });
    expect(byPath.folderPath).toBe('billing/invoices');
    expect(byId.folderId).toBe(FOLDER_ID);
    expect(toRoot.folderId).toBeNull();
  });

  test('delete sends DELETE and returns deleted envelope', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        return Response.json({ deleted: true, id: WORKFLOW_ID });
      }) as typeof globalThis.fetch,
    });

    const deleted = await client.automations.delete('workflows.extract-invoice');
    expect(requests[0]!.method).toBe('DELETE');
    expect(new URL(requests[0]!.url).pathname).toBe('/v1/automations/workflows.extract-invoice');
    expect(deleted).toEqual({ deleted: true, id: WORKFLOW_ID });
  });

  test('maps move/delete errors to typed exceptions', async () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        if (request.method === 'PATCH') {
          return Response.json(
            {
              issues: [
                {
                  field: 'id',
                  message: 'Agent automations cannot be moved; they have no folder model',
                  code: 'invalid_value',
                },
              ],
            },
            { status: 400 }
          );
        }
        return Response.json(
          { issues: [{ field: 'id', message: 'Automation not found', code: 'not_found' }] },
          { status: 404 }
        );
      }) as typeof globalThis.fetch,
    });

    await expect(
      client.automations.move('agents.invoice-agent', { folderPath: 'billing' })
    ).rejects.toBeInstanceOf(EigenpalValidationError);
    await expect(client.automations.delete('missing')).rejects.toBeInstanceOf(
      EigenpalNotFoundError
    );
  });

  test('public facade and generated docs cover move, delete, and folderId list', () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: (async () => new Response('{}')) as typeof globalThis.fetch,
      maxRetries: 0,
    });
    expect(typeof client.automations.list).toBe('function');
    expect(typeof client.automations.move).toBe('function');
    expect(typeof client.automations.delete).toBe('function');
    expect(typeof client.folders.list).toBe('function');

    const docs = readFileSync(join(import.meta.dir, '../docs/reference.md'), 'utf8');
    expect(docs).toContain('### `client.automations.move`');
    expect(docs).toContain('### `client.automations.delete`');
    expect(docs).toContain('folderId');
    expect(docs).toContain('folderPath');
    expect(docs).toContain('keep execution history');
    expect(docs).toContain('best-effort-delete agent storage');
  });
});
