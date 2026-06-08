import type { OperationResult } from '../client';
import { EigenpalError } from '../errors';
import type { Client } from '../generated/client';
import {
  runsArtifactGet,
  runsCancel,
  runsComparisonGet,
  runsConnect,
  runsExpectedCreate,
  runsExpectedFileDelete,
  runsExpectedFileGet,
  runsExpectedFileUpdate,
  runsExpectedGet,
  runsFeedbackClear,
  runsFeedbackGet,
  runsFeedbackUpdate,
  runsFilesDelete,
  runsFilesList,
  runsFilesUpload,
  runsFilesZipGet,
  runsGet,
  runsList,
  runsRerun,
  runsResume,
  runsTraceGet,
} from '../generated/sdk.gen';
import type {
  RunRerunRequest,
  RunsCancelResponse,
  RunsComparisonGetResponse,
  RunsConnectResponse,
  RunsExpectedCreateData,
  RunsExpectedCreateResponse,
  RunsExpectedFileDeleteResponse,
  RunsExpectedFileUpdateData,
  RunsExpectedFileUpdateResponse,
  RunsExpectedGetResponse,
  RunsFeedbackClearResponse,
  RunsFeedbackGetResponse,
  RunsFeedbackUpdateData,
  RunsFeedbackUpdateResponse,
  RunsFilesDeleteResponse,
  RunsFilesListResponse,
  RunsFilesUploadData,
  RunsFilesUploadResponse,
  RunsGetResponse,
  RunsListData,
  RunsListResponse,
  RunsRerunResponse,
  RunsResumeResponse,
  RunsTraceGetResponse,
} from '../generated/types.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;

export type ListRunsOptions = NonNullable<RunsListData['query']> & { signal?: AbortSignal };
type SignalOptions = { signal?: AbortSignal };

export class RunsResource {
  public readonly feedback: RunsFeedbackResource;
  public readonly expected: RunsExpectedResource;
  public readonly files: RunsFilesResource;
  public readonly artifacts: RunsArtifactsResource;
  public readonly comparison: RunsComparisonResource;
  public readonly trace: RunsTraceResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.feedback = new RunsFeedbackResource(client, dispatch);
    this.expected = new RunsExpectedResource(client, dispatch);
    this.files = new RunsFilesResource(client, dispatch);
    this.artifacts = new RunsArtifactsResource(client);
    this.comparison = new RunsComparisonResource(client, dispatch);
    this.trace = new RunsTraceResource(client, dispatch);
  }

  async list(options: ListRunsOptions = {}): Promise<RunsListResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() => runsList({ client: this.client, query, signal }));
  }

  async get(runId: string, options: { include?: string; signal?: AbortSignal } = {}) {
    const response = await this.dispatch<RunsGetResponse>(() =>
      runsGet({
        client: this.client,
        path: { id: runId },
        query: options.include ? { include: options.include } : {},
        signal: options.signal,
      })
    );
    return response.run;
  }

  async resume(runId: string, options: SignalOptions = {}): Promise<RunsResumeResponse> {
    return this.dispatch(() =>
      runsResume({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async cancel(runId: string, options: SignalOptions = {}): Promise<RunsCancelResponse> {
    return this.dispatch(() =>
      runsCancel({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async rerun(
    runId: string,
    body: RunRerunRequest = {},
    options: SignalOptions = {}
  ): Promise<RunsRerunResponse> {
    return this.dispatch(() =>
      runsRerun({ client: this.client, path: { id: runId }, body, signal: options.signal })
    );
  }

  async compare(
    referenceRunId: string,
    runId: string,
    options: {
      baseline?: boolean;
      step?: string;
      normalizeDates?: boolean;
      signal?: AbortSignal;
    } = {}
  ): Promise<RunComparisonReport> {
    const mode = options.baseline ? 'baseline' : 'expected';
    const [reference, target] = await Promise.all([
      this.get(referenceRunId, {
        include: mode === 'baseline' ? 'detail,files,output' : 'detail,expected',
        signal: options.signal,
      }),
      this.get(runId, { include: 'detail,files,output', signal: options.signal }),
    ]);

    if (isWorkflowRun(reference) && isWorkflowRun(target)) {
      return compareWorkflowRuns(referenceRunId, reference, runId, target, options.step);
    }
    if (options.step) {
      throw new EigenpalError(
        '`step` is only supported when both runs are workflow runs. Agent runs do not have workflow steps.',
        { status: 400 }
      );
    }
    if (isWorkflowRun(reference) || isWorkflowRun(target)) {
      throw new EigenpalError(
        'Mixed workflow/agent comparisons are not supported. Compare two workflow runs or two agent runs.',
        { status: 400 }
      );
    }
    return compareArtifactRuns(
      referenceRunId,
      reference,
      runId,
      target,
      mode,
      Boolean(options.normalizeDates)
    );
  }

  async connect(runId: string, options: SignalOptions = {}): Promise<RunsConnectResponse> {
    return this.dispatch(() =>
      runsConnect({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }
}

type RunRecord = Record<string, unknown>;
type ComparisonMode = 'expected' | 'baseline';

export type RunComparisonReport = {
  status: 'pass' | 'fail';
  runId: string;
  comparedWithRunId: string;
  mode?: ComparisonMode;
  steps?: Array<Record<string, unknown>>;
  jsonDifferences?: Array<Record<string, string>>;
  matchedFiles?: Array<Record<string, string>>;
  missingFiles?: string[];
  extraFiles?: string[];
  warnings?: string[];
};

function isWorkflowRun(run: unknown): run is RunRecord & { stepExecutions: unknown[] } {
  return isRecord(run) && Array.isArray(run.stepExecutions);
}

function isRecord(value: unknown): value is RunRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function compareWorkflowRuns(
  referenceRunId: string,
  reference: RunRecord & { stepExecutions: unknown[] },
  runId: string,
  target: RunRecord & { stepExecutions: unknown[] },
  stepFilter?: string
): RunComparisonReport {
  const wanted = stepFilter
    ?.split(',')
    .map((step) => step.trim())
    .filter(Boolean);
  const targetSteps = new Map(
    target.stepExecutions
      .filter(isRecord)
      .map((step) => [String(step.stepName ?? step.name ?? step.id ?? ''), step])
  );
  const steps = reference.stepExecutions
    .filter(isRecord)
    .filter(
      (step) => !wanted?.length || wanted.includes(String(step.stepName ?? step.name ?? step.id))
    )
    .map((referenceStep) => {
      const stepName = String(
        referenceStep.stepName ?? referenceStep.name ?? referenceStep.id ?? ''
      );
      const targetStep = targetSteps.get(stepName);
      const referenceOutput = referenceStep.outputData ?? referenceStep.output;
      const targetOutput = targetStep?.outputData ?? targetStep?.output;
      return {
        stepName,
        referenceStatus: String(referenceStep.status ?? ''),
        targetStatus: String(targetStep?.status ?? 'missing'),
        outputState: stableJson(referenceOutput) === stableJson(targetOutput) ? 'match' : 'diff',
      };
    });
  return {
    status: steps.every((step) => step.targetStatus !== 'missing' && step.outputState === 'match')
      ? 'pass'
      : 'fail',
    runId,
    comparedWithRunId: referenceRunId,
    steps,
  };
}

function compareArtifactRuns(
  referenceRunId: string,
  reference: unknown,
  runId: string,
  target: unknown,
  mode: ComparisonMode,
  normalizeDates: boolean
): RunComparisonReport {
  const referenceRun = isRecord(reference) ? reference : {};
  const targetRun = isRecord(target) ? target : {};
  const expectedValue = mode === 'baseline' ? referenceRun.output : referenceRun.expected;
  const expectedFiles =
    mode === 'baseline' ? names(referenceRun.resultFiles) : names(referenceRun.expectedFiles);
  const outputFiles = names(targetRun.resultFiles);
  const missing = expectedFiles.filter(
    (name) =>
      !outputFiles.some(
        (out) => comparableName(out, normalizeDates) === comparableName(name, normalizeDates)
      )
  );
  const extra = outputFiles.filter(
    (name) =>
      !expectedFiles.some(
        (exp) => comparableName(exp, normalizeDates) === comparableName(name, normalizeDates)
      )
  );
  const matched = expectedFiles
    .filter((name) => !missing.includes(name))
    .map((name) => ({
      expected: name,
      actual:
        outputFiles.find(
          (out) => comparableName(out, normalizeDates) === comparableName(name, normalizeDates)
        ) ?? name,
    }));
  const jsonDifferences = diffJson(expectedValue, targetRun.output);
  return {
    status:
      jsonDifferences.length === 0 && missing.length === 0 && extra.length === 0 ? 'pass' : 'fail',
    runId,
    comparedWithRunId: referenceRunId,
    mode,
    jsonDifferences,
    matchedFiles: matched,
    missingFiles: missing,
    extraFiles: extra,
  };
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (isRecord(item) ? String(item.name ?? '') : '')).filter(Boolean);
}

function comparableName(value: string, normalizeDates: boolean): string {
  if (!normalizeDates) return value;
  return value.replace(/\d{4}-\d{2}-\d{2}/g, '<date>').replace(/\d{8}/g, '<date>');
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function diffJson(
  expected: unknown,
  actual: unknown,
  basePath = '$'
): Array<Record<string, string>> {
  if (expected == null) return [];
  if (Object.is(expected, actual)) return [];
  if (isRecord(expected) && isRecord(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    return [...keys].flatMap((key) => {
      const next = `${basePath}.${key}`;
      if (!(key in actual)) return [{ path: next, type: 'missing' }];
      if (!(key in expected)) return [{ path: next, type: 'extra' }];
      return diffJson(expected[key], actual[key], next);
    });
  }
  return [{ path: basePath, type: 'changed' }];
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
    body: RunsFeedbackUpdateData['body'],
    options: SignalOptions = {}
  ): Promise<RunsFeedbackUpdateResponse> {
    return this.dispatch(() =>
      runsFeedbackUpdate({
        client: this.client,
        path: { id: runId },
        body,
        signal: options.signal,
      })
    );
  }

  async resolve(
    runId: string,
    body: Omit<NonNullable<RunsFeedbackUpdateData['body']>, 'status'> = {},
    options: SignalOptions = {}
  ): Promise<RunsFeedbackUpdateResponse> {
    return this.update(runId, { ...body, status: 'resolved' }, options);
  }

  async clear(runId: string, options: SignalOptions = {}): Promise<RunsFeedbackClearResponse> {
    return this.dispatch(() =>
      runsFeedbackClear({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }
}

export class RunsExpectedResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(runId: string, options: SignalOptions = {}): Promise<RunsExpectedGetResponse> {
    return this.dispatch(() =>
      runsExpectedGet({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async copyOutput(
    runId: string,
    body: RunsExpectedCreateData['body'],
    options: SignalOptions = {}
  ): Promise<RunsExpectedCreateResponse> {
    return this.dispatch(() =>
      runsExpectedCreate({
        client: this.client,
        path: { id: runId },
        body,
        signal: options.signal,
      })
    );
  }

  async upload(
    runId: string,
    file: Blob,
    options: { name?: string; filename?: string; signal?: AbortSignal } = {}
  ): Promise<RunsExpectedCreateResponse> {
    const form = new FormData();
    if (options.filename) form.append('file', file, options.filename);
    else form.append('file', file);
    if (options.name) form.append('name', options.name);
    return this.dispatch(
      () =>
        this.client.post({
          url: '/api/v1/runs/{id}/expected',
          path: { id: runId },
          body: form,
          signal: options.signal,
        }) as Promise<OperationResult<RunsExpectedCreateResponse>>
    );
  }

  async rename(
    runId: string,
    filename: string,
    body: RunsExpectedFileUpdateData['body'],
    options: SignalOptions = {}
  ): Promise<RunsExpectedFileUpdateResponse> {
    return this.dispatch(() =>
      runsExpectedFileUpdate({
        client: this.client,
        path: { id: runId, filename },
        body,
        signal: options.signal,
      })
    );
  }

  async delete(
    runId: string,
    filename: string,
    options: SignalOptions = {}
  ): Promise<RunsExpectedFileDeleteResponse> {
    return this.dispatch(() =>
      runsExpectedFileDelete({
        client: this.client,
        path: { id: runId, filename },
        signal: options.signal,
      })
    );
  }

  async download(runId: string, filename: string, options: SignalOptions = {}): Promise<Blob> {
    return downloadBlob(
      () =>
        runsExpectedFileGet({
          client: this.client,
          path: { id: runId, filename },
          parseAs: 'blob',
          signal: options.signal,
        }) as Promise<OperationResult<Blob>>
    );
  }
}

export class RunsFilesResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(runId: string, options: SignalOptions = {}): Promise<RunsFilesListResponse> {
    return this.dispatch(() =>
      runsFilesList({ client: this.client, path: { id: runId }, signal: options.signal })
    );
  }

  async upload(
    runId: string,
    body: RunsFilesUploadData['body'],
    options: SignalOptions = {}
  ): Promise<RunsFilesUploadResponse> {
    return this.dispatch(() =>
      runsFilesUpload({ client: this.client, path: { id: runId }, body, signal: options.signal })
    );
  }

  async delete(
    runId: string,
    fileId: string,
    options: SignalOptions = {}
  ): Promise<RunsFilesDeleteResponse> {
    return this.dispatch(() =>
      runsFilesDelete({
        client: this.client,
        path: { id: runId, fileId },
        signal: options.signal,
      })
    );
  }
}

export class RunsArtifactsResource {
  constructor(private readonly client: Client) {}

  async download(runId: string, path: string, options: SignalOptions = {}): Promise<Blob> {
    return downloadBlob(
      () =>
        runsArtifactGet({
          client: this.client,
          path: { id: runId, path },
          parseAs: 'blob',
          signal: options.signal,
        }) as Promise<OperationResult<Blob>>
    );
  }

  async downloadZip(
    runId: string,
    options: { files?: string; token?: string; signal?: AbortSignal } = {}
  ): Promise<Blob> {
    const { signal, ...query } = options;
    return downloadBlob(
      () =>
        runsFilesZipGet({
          client: this.client,
          path: { id: runId },
          query,
          parseAs: 'blob',
          signal,
        }) as Promise<OperationResult<Blob>>
    );
  }
}

export class RunsComparisonResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async get(runId: string, options: SignalOptions = {}): Promise<RunsComparisonGetResponse> {
    return this.dispatch(() =>
      runsComparisonGet({ client: this.client, path: { id: runId }, signal: options.signal })
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

async function downloadBlob(call: () => Promise<OperationResult<Blob>>): Promise<Blob> {
  const result = await call();
  if (result.response?.ok && result.data instanceof Blob) {
    return result.data;
  }
  throw new EigenpalError('Failed to download run artifact.', {
    status: result.response?.status ?? 0,
  });
}
