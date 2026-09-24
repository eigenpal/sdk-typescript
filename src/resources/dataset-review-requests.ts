import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import { datasetReviewRequestsList } from '../generated/sdk.gen';
import type { DatasetReviewInboxList } from '../generated/types.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };

export type ListDatasetReviewRequestsOptions = SignalOptions & {
  status?: string | readonly string[];
  limit?: number;
  offset?: number;
};

function joinCsv(values: string | readonly string[] | undefined): string | undefined {
  if (values === undefined) return undefined;
  if (typeof values === 'string') return values;
  return values.join(',');
}

/** Tenant-wide dataset review inbox. Reviewer-facing: no workflow access required. */
export class DatasetReviewRequestsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(options: ListDatasetReviewRequestsOptions = {}): Promise<DatasetReviewInboxList> {
    const { signal, status, limit, offset } = options;
    return this.dispatch(() =>
      datasetReviewRequestsList({
        client: this.client,
        query: { status: joinCsv(status), limit, offset },
        signal,
      })
    );
  }
}
