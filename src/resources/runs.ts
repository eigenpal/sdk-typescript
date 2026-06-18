import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import {
  runsArtifactsGet,
  runsArtifactsList,
  runsCancel,
  runsEvalResultsList,
  runsEventsList,
  runsFeedbackClear,
  runsFeedbackGet,
  runsFeedbackUpdate,
  runsGet,
  runsList,
  runsPromote,
  runsRerun,
  runsStepsList,
  runsTraceGet,
  runsUsageGet,
} from '../generated/sdk.gen';
import type {
  RunsArtifactsListResponse,
  RunsCancelResponse,
  RunsEvalResultsListResponse,
  RunsEventsListResponse,
  RunsFeedbackClearResponse,
  RunsFeedbackGetResponse,
  RunsFeedbackUpdateResponse,
  RunsGetResponse,
  RunsListData,
  RunsListResponse,
  RunsPromoteResponse,
  RunsRerunResponse,
  RunsStepsListResponse,
  RunsTraceGetResponse,
  RunsUsageGetResponse,
} from '../generated/types.gen';

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
  public readonly evalResults: RunsEvalResultsResource;
  public readonly feedback: RunsFeedbackResource;
  public readonly trace: RunsTraceResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.artifacts = new RunsArtifactsResource(client, dispatch);
    this.evalResults = new RunsEvalResultsResource(client, dispatch);
    this.feedback = new RunsFeedbackResource(client, dispatch);
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

export class RunsFeedbackResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async get(runId: string, options: SignalOptions = {}): Promise<RunsFeedbackGetResponse> {
    return this.dispatch(() =>
      runsFeedbackGet({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async update(
    runId: string,
    body: Record<string, unknown>,
    options: SignalOptions = {}
  ): Promise<RunsFeedbackUpdateResponse> {
    return this.dispatch(() =>
      runsFeedbackUpdate({
        client: this.client,
        path: { id: runId },
        body: body as never,
        signal: options.signal,
      })
    );
  }

  async clear(runId: string, options: SignalOptions = {}): Promise<RunsFeedbackClearResponse> {
    return this.dispatch(() =>
      runsFeedbackClear({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }
}

export class RunsEvalResultsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(runId: string, options: SignalOptions = {}): Promise<RunsEvalResultsListResponse> {
    return this.dispatch(() =>
      runsEvalResultsList({ client: this.client, path: { id: runId }, signal: options.signal })
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
