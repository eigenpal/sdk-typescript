import { describe, expect, test } from 'bun:test';
import { EigenpalClient } from '../src';

const WORKFLOW_ID = 'wf_01ABCDEFGHJKMNPQRSTVWXYZ';
const REVIEW_ID = 'dsr_01ABCDEFGHJKMNPQRSTVWXYZ';
const ITEM_ID = 'dsri_01ABCDEFGHJKMNPQRSTVWXYZ';

describe('dataset review requests resource', () => {
  test('list encodes status filter and pagination query params', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        return Response.json({ data: [], total: 0, limit: 20, offset: 5 });
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.list(WORKFLOW_ID, {
      status: ['open', 'paused'],
      limit: 20,
      offset: 5,
    });

    expect(requests[0]!.method).toBe('GET');
    const url = new URL(requests[0]!.url);
    expect(url.pathname).toBe(`/v1/automations/${WORKFLOW_ID}/dataset-review-requests`);
    expect(url.searchParams.get('status')).toBe('open,paused');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('5');
  });

  test('create posts the review request body', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input, init) => {
        const request = new Request(input, init);
        requests.push(request.clone());
        return Response.json({ id: REVIEW_ID, status: 'open' }, { status: 201 });
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.create(WORKFLOW_ID, {
      title: 'Q1 GT review',
      exampleNames: ['invoice-foo', 'invoice-bar'],
      instructions: 'Check totals',
      focusFields: [{ path: 'vendor.iban', reason: 'OCR often mangles IBANs' }],
      ignoredFields: ['currency'],
      itemNotes: [
        {
          exampleName: 'invoice-foo',
          comment: 'Totals drifted',
          fields: [{ path: 'total', comment: 'off by 0.01' }],
        },
      ],
      status: 'open',
    });

    expect(requests[0]!.method).toBe('POST');
    expect(new URL(requests[0]!.url).pathname).toBe(
      `/v1/automations/${WORKFLOW_ID}/dataset-review-requests`
    );
    expect(await requests[0]!.clone().json()).toEqual({
      title: 'Q1 GT review',
      exampleNames: ['invoice-foo', 'invoice-bar'],
      instructions: 'Check totals',
      focusFields: [{ path: 'vendor.iban', reason: 'OCR often mangles IBANs' }],
      ignoredFields: ['currency'],
      itemNotes: [
        {
          exampleName: 'invoice-foo',
          comment: 'Totals drifted',
          fields: [{ path: 'total', comment: 'off by 0.01' }],
        },
      ],
      status: 'open',
    });
  });

  test('update patches request metadata and status', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input, init) => {
        const request = new Request(input, init);
        requests.push(request.clone());
        return Response.json({ id: REVIEW_ID, status: 'closed' });
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.update(WORKFLOW_ID, REVIEW_ID, {
      status: 'closed',
      title: 'Done',
    });

    expect(requests[0]!.method).toBe('PATCH');
    expect(new URL(requests[0]!.url).pathname).toBe(
      `/v1/automations/${WORKFLOW_ID}/dataset-review-requests/${REVIEW_ID}`
    );
    expect(await requests[0]!.clone().json()).toEqual({
      status: 'closed',
      title: 'Done',
    });
  });

  test('updateItem patches item action payload', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input, init) => {
        const request = new Request(input, init);
        requests.push(request.clone());
        return Response.json({ item: { id: ITEM_ID, status: 'edited' } });
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.updateItem(WORKFLOW_ID, REVIEW_ID, ITEM_ID, {
      action: 'edit',
      expected: { total: 42 },
      comment: 'fixed total',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(requests[0]!.method).toBe('PATCH');
    expect(new URL(requests[0]!.url).pathname).toBe(
      `/v1/automations/${WORKFLOW_ID}/dataset-review-requests/${REVIEW_ID}/items/${ITEM_ID}`
    );
    expect(await requests[0]!.clone().json()).toEqual({
      action: 'edit',
      expected: { total: 42 },
      comment: 'fixed total',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  test('updateItem can attach a field-scoped comment', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input, init) => {
        const request = new Request(input, init);
        requests.push(request.clone());
        return Response.json({ item: { id: ITEM_ID, status: 'pending' } });
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.updateItem(WORKFLOW_ID, REVIEW_ID, ITEM_ID, {
      action: 'comment',
      comment: 'wrong IBAN',
      fieldPath: 'vendor.iban',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(await requests[0]!.clone().json()).toEqual({
      action: 'comment',
      comment: 'wrong IBAN',
      fieldPath: 'vendor.iban',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  test('updateItem records and clears field-decision', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input, init) => {
        const request = new Request(input, init);
        requests.push(request.clone());
        return Response.json({ item: { id: ITEM_ID, status: 'pending', fieldDecisions: {} } });
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.updateItem(WORKFLOW_ID, REVIEW_ID, ITEM_ID, {
      action: 'field-decision',
      fieldPath: 'vendor.iban',
      decision: 'removed',
      comment: 'OCR mangled',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    await client.automations.datasetReviewRequests.updateItem(WORKFLOW_ID, REVIEW_ID, ITEM_ID, {
      action: 'field-decision',
      fieldPath: 'vendor.iban',
      decision: null,
      expectedUpdatedAt: '2026-01-01T00:00:01.000Z',
    });

    expect(await requests[0]!.clone().json()).toEqual({
      action: 'field-decision',
      fieldPath: 'vendor.iban',
      decision: 'removed',
      comment: 'OCR mangled',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(await requests[1]!.clone().json()).toEqual({
      action: 'field-decision',
      fieldPath: 'vendor.iban',
      decision: null,
      expectedUpdatedAt: '2026-01-01T00:00:01.000Z',
    });
  });

  test('events reads the events sub-resource', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        return Response.json({ events: [] });
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.events(WORKFLOW_ID, REVIEW_ID);

    expect(requests[0]!.method).toBe('GET');
    expect(new URL(requests[0]!.url).pathname).toBe(
      `/v1/automations/${WORKFLOW_ID}/dataset-review-requests/${REVIEW_ID}/events`
    );
  });

  test('getItemFile defaults to input and supports kind=expected', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        return new Response(new Blob(['bytes']));
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.getItemFile(
      WORKFLOW_ID,
      REVIEW_ID,
      ITEM_ID,
      'expected/report final.pdf'
    );
    await client.automations.datasetReviewRequests.getItemFile(
      WORKFLOW_ID,
      REVIEW_ID,
      ITEM_ID,
      'expected/report.pdf',
      { kind: 'expected' }
    );

    expect(requests).toHaveLength(2);
    const inputUrl = new URL(requests[0]!.url);
    expect(inputUrl.pathname).toBe(
      `/v1/automations/${WORKFLOW_ID}/dataset-review-requests/${REVIEW_ID}/items/${ITEM_ID}/files/expected/report%20final.pdf`
    );
    expect(inputUrl.searchParams.get('kind')).toBeNull();
    const expectedUrl = new URL(requests[1]!.url);
    expect(expectedUrl.pathname).toBe(
      `/v1/automations/${WORKFLOW_ID}/dataset-review-requests/${REVIEW_ID}/items/${ITEM_ID}/files/expected/report.pdf`
    );
    expect(expectedUrl.searchParams.get('kind')).toBe('expected');
  });

  test('recordItemFileDecision patches a file-decision body', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input, init) => {
        const request = new Request(input, init);
        requests.push(request.clone());
        return Response.json({ item: { id: ITEM_ID, status: 'pending', fileDecisions: {} } });
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.recordItemFileDecision(
      WORKFLOW_ID,
      REVIEW_ID,
      ITEM_ID,
      {
        filePath: 'expected/report.pdf',
        decision: 'approved',
        comment: 'totals match',
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      }
    );
    await client.automations.datasetReviewRequests.recordItemFileDecision(
      WORKFLOW_ID,
      REVIEW_ID,
      ITEM_ID,
      {
        filePath: 'expected/report.pdf',
        decision: null,
        expectedUpdatedAt: '2026-01-01T00:00:01.000Z',
      }
    );

    expect(requests[0]!.method).toBe('PATCH');
    expect(await requests[0]!.clone().json()).toEqual({
      action: 'file-decision',
      filePath: 'expected/report.pdf',
      decision: 'approved',
      comment: 'totals match',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(await requests[1]!.clone().json()).toEqual({
      action: 'file-decision',
      filePath: 'expected/report.pdf',
      decision: null,
      expectedUpdatedAt: '2026-01-01T00:00:01.000Z',
    });
  });

  test('editItemFile sends multipart edit-file with corrected path', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input, init) => {
        const request = new Request(input, init);
        requests.push(request.clone());
        return Response.json({ item: { id: ITEM_ID, status: 'edited' } });
      }) as typeof globalThis.fetch,
    });

    await client.automations.datasetReviewRequests.editItemFile(
      WORKFLOW_ID,
      REVIEW_ID,
      ITEM_ID,
      new File(['fixed'], 'report.pdf', { type: 'application/pdf' }),
      {
        filePath: 'expected/report.pdf',
        comment: 'fixed total',
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      }
    );

    expect(requests[0]!.method).toBe('PATCH');
    const form = await requests[0]!.clone().formData();
    expect(form.get('action')).toBe('edit-file');
    expect(form.get('filePath')).toBe('expected/report.pdf');
    expect(form.get('newPath')).toBeNull();
    expect(form.get('comment')).toBe('fixed total');
    expect(form.get('expectedUpdatedAt')).toBe('2026-01-01T00:00:00.000Z');
    const uploaded = form.get('file');
    expect(uploaded).toBeInstanceOf(File);
    expect((uploaded as File).name).toBe('report.pdf');
    expect(await (uploaded as File).text()).toBe('fixed');
  });
});
