import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EigenpalClient, EigenpalNotFoundError, EigenpalValidationError } from '../src';
import type { Folder, ListFoldersResponse } from '../src/generated/types.gen';

const FOLDER_ID = 'fldr_01ABCDEFGHJKMNPQRSTVWXYZ';
const PARENT_ID = 'fldr_01PARENT0000000000000000';

function publicFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: FOLDER_ID,
    parentId: null,
    type: 'workflow',
    name: 'invoices',
    createdAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('folders resource', () => {
  test('lists with required type and optional parentId/tree query', async () => {
    const requests: Request[] = [];
    const listing: ListFoldersResponse = [publicFolder({ childCount: 1, workflowCount: 2 })];
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

    const page = await client.folders.list({
      type: 'workflow',
      parentId: 'null',
      tree: 'true',
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe('GET');
    expect(new URL(requests[0]!.url).pathname).toBe('/v1/folders');
    expect(new URL(requests[0]!.url).searchParams.get('type')).toBe('workflow');
    expect(new URL(requests[0]!.url).searchParams.get('parentId')).toBe('null');
    expect(new URL(requests[0]!.url).searchParams.get('tree')).toBe('true');
    expect(page).toEqual(listing);
    expect(page[0]).toMatchObject({ type: 'workflow', name: 'invoices' });
  });

  test('create/get/update/delete match verbs, bodies, and public responses', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        if (request.method === 'POST' && new URL(request.url).pathname === '/v1/folders') {
          return Response.json(publicFolder({ parentId: PARENT_ID }), { status: 201 });
        }
        if (
          request.method === 'GET' &&
          new URL(request.url).pathname === `/v1/folders/${FOLDER_ID}`
        ) {
          return Response.json(publicFolder());
        }
        if (
          request.method === 'PATCH' &&
          new URL(request.url).pathname === `/v1/folders/${FOLDER_ID}`
        ) {
          return Response.json(publicFolder({ name: 'billing', parentId: null }));
        }
        if (
          request.method === 'DELETE' &&
          new URL(request.url).pathname === `/v1/folders/${FOLDER_ID}`
        ) {
          return Response.json({ deleted: true, id: FOLDER_ID });
        }
        throw new Error(`Unexpected ${request.method} ${request.url}`);
      }) as typeof globalThis.fetch,
    });

    const created = await client.folders.create({
      name: 'invoices',
      type: 'workflow',
      parentId: PARENT_ID,
    });
    const fetched = await client.folders.get(FOLDER_ID);
    const updated = await client.folders.update(FOLDER_ID, { name: 'billing', parentId: null });
    const deleted = await client.folders.delete(FOLDER_ID);

    expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
      ['POST', '/v1/folders'],
      ['GET', `/v1/folders/${FOLDER_ID}`],
      ['PATCH', `/v1/folders/${FOLDER_ID}`],
      ['DELETE', `/v1/folders/${FOLDER_ID}`],
    ]);
    expect(await requests[0]!.json()).toEqual({
      name: 'invoices',
      type: 'workflow',
      parentId: PARENT_ID,
    });
    expect(await requests[2]!.json()).toEqual({ name: 'billing', parentId: null });
    expect(created).toEqual(publicFolder({ parentId: PARENT_ID }));
    expect(fetched.id).toBe(FOLDER_ID);
    expect(updated).toEqual(publicFolder({ name: 'billing', parentId: null }));
    expect(deleted).toEqual({ deleted: true, id: FOLDER_ID });
  });

  test('maps 404 and 400 envelopes to typed errors', async () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        if (request.method === 'GET') {
          return Response.json(
            { issues: [{ field: 'id', message: 'Folder not found', code: 'not_found' }] },
            { status: 404 }
          );
        }
        return Response.json(
          {
            issues: [
              {
                field: 'parentId',
                message: 'Cannot move a folder into itself',
                code: 'invalid_value',
              },
            ],
          },
          { status: 400 }
        );
      }) as typeof globalThis.fetch,
    });

    await expect(client.folders.get(FOLDER_ID)).rejects.toBeInstanceOf(EigenpalNotFoundError);
    await expect(client.folders.update(FOLDER_ID, { parentId: FOLDER_ID })).rejects.toBeInstanceOf(
      EigenpalValidationError
    );
  });

  test('public facade and generated docs cover folder methods', () => {
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      fetch: (async () => new Response('{}')) as typeof globalThis.fetch,
      maxRetries: 0,
    });
    expect(typeof client.folders.list).toBe('function');
    expect(typeof client.folders.get).toBe('function');
    expect(typeof client.folders.create).toBe('function');
    expect(typeof client.folders.update).toBe('function');
    expect(typeof client.folders.delete).toBe('function');

    const docs = readFileSync(join(import.meta.dir, '../docs/reference.md'), 'utf8');
    expect(docs).toContain('### `client.folders.list`');
    expect(docs).toContain('### `client.folders.create`');
    expect(docs).toContain('### `client.folders.get`');
    expect(docs).toContain('### `client.folders.update`');
    expect(docs).toContain('### `client.folders.delete`');
    expect(docs).toContain("type: 'workflow'");
    expect(docs).not.toContain('agent folders');
  });
});
