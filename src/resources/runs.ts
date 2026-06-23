import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import {
  runsArtifactsGet,
  runsArtifactsList,
  runsCancel,
  runsEventsList,
  runsGet,
  runsList,
  runsPromote,
  runsRerun,
  runsReviewsClear,
  runsReviewsExpectedCreate,
  runsReviewsExpectedFileDelete,
  runsReviewsExpectedFileGet,
  runsReviewsExpectedFileUpdate,
  runsReviewsExpectedGet,
  runsReviewsGet,
  runsReviewsUpdate,
  runsScoresList,
  runsStepsList,
  runsTraceGet,
  runsUsageGet,
} from '../generated/sdk.gen';
import type {
  RunsArtifactsListResponse,
  RunsCancelResponse,
  RunsEventsListResponse,
  RunsGetResponse,
  RunsListData,
  RunsListResponse,
  RunsPromoteResponse,
  RunsRerunResponse,
  RunsReviewsClearResponse,
  RunsReviewsExpectedCreateResponse,
  RunsReviewsExpectedFileDeleteResponse,
  RunsReviewsExpectedFileUpdateResponse,
  RunsReviewsExpectedGetResponse,
  RunsReviewsGetResponse,
  RunsReviewsUpdateResponse,
  RunsScoresListResponse,
  RunsStepsListResponse,
  RunsTraceGetResponse,
  RunsUsageGetResponse,
} from '../generated/types.gen';
import { buildSingleFileMultipart, type FileInput } from '../lib/files';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };

export type ListRunsOptions = NonNullable<RunsListData['query']> & { signal?: AbortSignal };

export type RunExpandSection = 'input' | 'usage' | 'execution' | 'debug';
export type RunExpand = readonly RunExpandSection[] | (string & {});

function formatExpand(expand: RunExpand | undefined): string | undefined {
  if (expand === undefined) return undefined;
  const joined = typeof expand === 'string' ? expand : expand.join(',');
  return joined.length > 0 ? joined : undefined;
}

export class RunsResource {
  public readonly artifacts: RunsArtifactsResource;
  public readonly scores: RunsScoresResource;
  public readonly reviews: RunsReviewsResource;
  public readonly trace: RunsTraceResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.artifacts = new RunsArtifactsResource(client, dispatch);
    this.scores = new RunsScoresResource(client, dispatch);
    this.reviews = new RunsReviewsResource(client, dispatch);
    this.trace = new RunsTraceResource(client, dispatch);
  }

  async list(options: ListRunsOptions = {}): Promise<RunsListResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() => runsList({ client: this.client, query, signal }));
  }

  async get(
    runId: string,
    options: { expand?: RunExpand; signal?: AbortSignal } = {}
  ): Promise<RunsGetResponse> {
    const expand = formatExpand(options.expand);
    return this.dispatch(() =>
      runsGet({
        client: this.client,
        path: { id: runId },
        query: expand ? { expand } : {},
        signal: options.signal,
      })
    );
  }

  async cancel(runId: string, options: SignalOptions = {}): Promise<RunsCancelResponse> {
    return this.dispatch(() =>
      runsCancel({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async promote(
    runId: string,
    body: Record<string, unknown> = {},
    options: SignalOptions = {}
  ): Promise<RunsPromoteResponse> {
    return this.dispatch(() =>
      runsPromote({
        client: this.client,
        path: { id: runId },
        body: body as never,
        signal: options.signal,
      })
    );
  }

  async rerun(
    runId: string,
    query: { version?: string; wait_for_completion?: number } = {},
    options: SignalOptions = {}
  ): Promise<RunsRerunResponse> {
    return this.dispatch(() =>
      runsRerun({ client: this.client, path: { id: runId }, query, signal: options.signal })
    );
  }

  async usage(runId: string, options: SignalOptions = {}): Promise<RunsUsageGetResponse> {
    return this.dispatch(() =>
      runsUsageGet({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async steps(runId: string, options: SignalOptions = {}): Promise<RunsStepsListResponse> {
    return this.dispatch(() =>
      runsStepsList({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async events(runId: string, options: SignalOptions = {}): Promise<RunsEventsListResponse> {
    return this.dispatch(() =>
      runsEventsList({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }
}

export function runOutput(run: unknown): unknown {
  return isRecord(run) ? run.output : undefined;
}

export function runUsage(run: unknown): unknown {
  return isRecord(run) ? run.usage : undefined;
}

export function runExecutionDetails(run: unknown): unknown {
  return isRecord(run) ? run.execution : undefined;
}

export class RunsArtifactsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(runId: string, options: SignalOptions = {}): Promise<RunsArtifactsListResponse> {
    return this.dispatch(() =>
      runsArtifactsList({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async download(runId: string, path: string, options: SignalOptions = {}): Promise<Blob> {
    return this.dispatch(async () => {
      const response = await runsArtifactsGet({
        client: this.client,
        path: { id: runId, path },
        signal: options.signal,
      });
      return response as OperationResult<Blob>;
    });
  }
}

export class RunsReviewsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async get(runId: string, options: SignalOptions = {}): Promise<RunsReviewsGetResponse> {
    return this.dispatch(() =>
      runsReviewsGet({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async update(
    runId: string,
    body: Record<string, unknown>,
    options: SignalOptions = {}
  ): Promise<RunsReviewsUpdateResponse> {
    return this.dispatch(() =>
      runsReviewsUpdate({
        client: this.client,
        path: { id: runId },
        body: body as never,
        signal: options.signal,
      })
    );
  }

  async clear(runId: string, options: SignalOptions = {}): Promise<RunsReviewsClearResponse> {
    return this.dispatch(() =>
      runsReviewsClear({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async listExpected(
    runId: string,
    options: SignalOptions = {}
  ): Promise<RunsReviewsExpectedGetResponse> {
    return this.dispatch(() =>
      runsReviewsExpectedGet({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async copyOutputToExpected(
    runId: string,
    outputFileName: string,
    options: { expectedName?: string; signal?: AbortSignal } = {}
  ): Promise<RunsReviewsExpectedCreateResponse> {
    return this.dispatch(() =>
      runsReviewsExpectedCreate({
        client: this.client,
        path: { id: runId },
        body: {
          outputFileName,
          ...(options.expectedName ? { expectedName: options.expectedName } : {}),
        },
        signal: options.signal,
      })
    );
  }

  async uploadExpected(
    runId: string,
    file: FileInput,
    options: { name?: string; signal?: AbortSignal } = {}
  ): Promise<RunsReviewsExpectedCreateResponse> {
    const formData = await buildSingleFileMultipart(file, options.name);
    return this.dispatch(
      () =>
        this.client.post({
          url: '/api/v1/runs/{id}/reviews/expected',
          path: { id: runId },
          body: formData,
          bodySerializer: null,
          headers: { 'Content-Type': null },
          signal: options.signal,
        }) as Promise<OperationResult<RunsReviewsExpectedCreateResponse>>
    );
  }

  async downloadExpected(
    runId: string,
    filename: string,
    options: SignalOptions = {}
  ): Promise<Blob> {
    return this.dispatch(async () => {
      const response = await runsReviewsExpectedFileGet({
        client: this.client,
        path: { id: runId, filename },
        signal: options.signal,
      });
      return response as OperationResult<Blob>;
    });
  }

  async renameExpected(
    runId: string,
    filename: string,
    newFilename: string,
    options: SignalOptions = {}
  ): Promise<RunsReviewsExpectedFileUpdateResponse> {
    return this.dispatch(() =>
      runsReviewsExpectedFileUpdate({
        client: this.client,
        path: { id: runId, filename },
        body: { name: newFilename },
        signal: options.signal,
      })
    );
  }

  async deleteExpected(
    runId: string,
    filename: string,
    options: SignalOptions = {}
  ): Promise<RunsReviewsExpectedFileDeleteResponse> {
    return this.dispatch(() =>
      runsReviewsExpectedFileDelete({
        client: this.client,
        path: { id: runId, filename },
        signal: options.signal,
      })
    );
  }
}

export class RunsScoresResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(runId: string, options: SignalOptions = {}): Promise<RunsScoresListResponse> {
    return this.dispatch(() =>
      runsScoresList({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }
}

export class RunsTraceResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async get(runId: string, options: SignalOptions = {}): Promise<RunsTraceGetResponse> {
    return this.dispatch(() =>
      runsTraceGet({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
