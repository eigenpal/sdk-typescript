import { describe, expect, test } from 'bun:test';
import { EigenpalClient } from '../src';
import type { HumanReviewFieldResponse, HumanReviewTaskDetail } from '../src/generated/types.gen';
import type { ConfirmHumanReviewFieldRequest } from '../src/resources/human-reviews';

const TASK_ID = 'hrt_01ABCDEFGHJKMNPQRSTVWXYZ';

function reviewTask(overrides: Partial<HumanReviewTaskDetail> = {}): HumanReviewTaskDetail {
  return {
    id: TASK_ID,
    executionId: 'run_01ABCDEFGHJKMNPQRSTVWXYZ',
    automationId: 'wf_01ABCDEFGHJKMNPQRSTVWXYZ',
    automationName: 'extract-invoice',
    sourceKind: 'workflow_step',
    sourceLabel: 'review',
    status: 'pending',
    requiredCount: 1,
    confirmedCount: 0,
    version: 2,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    files: [],
    input: null,
    machineData: {},
    draftData: { 'vendor.name': 'Acme Corp' },
    schema: null,
    fieldMetadata: {},
    requiredPaths: ['vendor.name'],
    selectionReasons: { 'vendor.name': 'always' },
    decisions: [],
    instructions: null,
    completedBy: null,
    completedAt: null,
    outcomeReason: null,
    ...overrides,
  };
}

function fieldResponse(
  taskOverrides: Partial<HumanReviewTaskDetail> = {}
): HumanReviewFieldResponse {
  return { task: reviewTask(taskOverrides) };
}

describe('humanReviews.confirmField', () => {
  test('forwards confirmed: false to withdraw a field confirmation', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        return Response.json(fieldResponse());
      }) as typeof globalThis.fetch,
    });

    const body: ConfirmHumanReviewFieldRequest = {
      path: 'vendor.name',
      value: 'Acme Corp',
      expectedVersion: 1,
      idempotencyKey: 'idem-withdraw-1',
      confirmed: false,
    };
    const response = await client.humanReviews.confirmField(TASK_ID, body);

    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe('PUT');
    expect(new URL(requests[0]!.url).pathname).toBe(`/v1/human-reviews/${TASK_ID}/fields`);
    expect(await requests[0]!.clone().json()).toEqual(body);
    expect(response.task.version).toBe(2);
    expect(response.task.confirmedCount).toBe(0);
  });

  test('remains backwards compatible when confirmed is omitted', async () => {
    const requests: Request[] = [];
    const client = new EigenpalClient({
      apiKey: 'eg_test',
      baseUrl: 'http://localhost:3000',
      maxRetries: 0,
      fetch: (async (input) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request.clone());
        return Response.json(fieldResponse({ confirmedCount: 1 }));
      }) as typeof globalThis.fetch,
    });

    const body: ConfirmHumanReviewFieldRequest = {
      path: 'total',
      value: 42,
      expectedVersion: 3,
      idempotencyKey: 'idem-confirm-1',
    };
    await client.humanReviews.confirmField(TASK_ID, body);

    expect(await requests[0]!.clone().json()).toEqual(body);
    expect(await requests[0]!.clone().json()).not.toHaveProperty('confirmed');
  });
});
