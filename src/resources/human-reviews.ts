import type { OperationResult, RequestDispatchOptions } from '../client';
import type { Client } from '../generated/client';
import {
  humanReviewsApprove,
  humanReviewsConfirmField,
  humanReviewsFilesContentGet,
  humanReviewsGet,
  humanReviewsList,
  humanReviewsReject,
} from '../generated/sdk.gen';
import type {
  HumanReviewsApproveResponse,
  HumanReviewsConfirmFieldResponse,
  HumanReviewsGetResponse,
  HumanReviewsListData,
  HumanReviewsListResponse,
  HumanReviewsRejectResponse,
} from '../generated/types.gen';

type Dispatch = <T>(
  call: () => Promise<OperationResult<T>>,
  options?: RequestDispatchOptions
) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };

export type ListHumanReviewsOptions = NonNullable<HumanReviewsListData['query']> & SignalOptions;

export class HumanReviewsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(options: ListHumanReviewsOptions = {}): Promise<HumanReviewsListResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() => humanReviewsList({ client: this.client, query, signal }));
  }

  async get(taskId: string, options: SignalOptions = {}): Promise<HumanReviewsGetResponse> {
    return this.dispatch(() =>
      humanReviewsGet({ client: this.client, path: { taskId }, signal: options.signal })
    );
  }

  async approve(
    taskId: string,
    body: { expectedVersion: number },
    options: SignalOptions = {}
  ): Promise<HumanReviewsApproveResponse> {
    return this.dispatch(() =>
      humanReviewsApprove({
        client: this.client,
        path: { taskId },
        body,
        signal: options.signal,
      })
    );
  }

  async confirmField(
    taskId: string,
    body: {
      path: string;
      value: string | number | boolean | null;
      expectedVersion: number;
      idempotencyKey: string;
    },
    options: SignalOptions = {}
  ): Promise<HumanReviewsConfirmFieldResponse> {
    return this.dispatch(() =>
      humanReviewsConfirmField({
        client: this.client,
        path: { taskId },
        body,
        signal: options.signal,
      })
    );
  }

  async reject(
    taskId: string,
    body: { reason: string; expectedVersion: number; idempotencyKey: string },
    options: SignalOptions = {}
  ): Promise<HumanReviewsRejectResponse> {
    return this.dispatch(() =>
      humanReviewsReject({
        client: this.client,
        path: { taskId },
        body,
        signal: options.signal,
      })
    );
  }

  async downloadFile(taskId: string, fileId: string, options: SignalOptions = {}): Promise<Blob> {
    return this.dispatch(
      async () => {
        const response = await humanReviewsFilesContentGet({
          client: this.client,
          path: { taskId, fileId },
          parseAs: 'blob',
          signal: options.signal,
        });
        return response as OperationResult<Blob>;
      },
      { responseKind: 'binary' }
    );
  }
}
