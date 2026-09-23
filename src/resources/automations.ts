import type { OperationResult, RequestDispatchOptions } from '../client';
import type { Client } from '../generated/client';
import {
  automationsDatasetExport,
  automationsDatasetImport,
  automationsDelete,
  automationsEvaluatorsGet,
  automationsEvaluatorsUpdate,
  automationsExamplesCreate,
  automationsExamplesDelete,
  automationsExamplesGet,
  automationsExamplesList,
  automationsExamplesRun,
  automationsExamplesUpdate,
  automationsExperimentsCancel,
  automationsExperimentsCreate,
  automationsExperimentsCreateStream,
  automationsExperimentsExport,
  automationsExperimentsExportAll,
  automationsExperimentsGet,
  automationsExperimentsList,
  automationsGet,
  automationsList,
  automationsReviewsHealth,
  automationsSync,
  automationsTriggersGet,
  automationsUpdate,
  automationsVersionsCreate,
  automationsVersionsList,
  automationsVersionsPromote,
  automationsVersionsRestore,
} from '../generated/sdk.gen';
import type {
  AutomationDetail,
  AutomationsListData,
  AutomationsReviewsHealthData,
  CreateAutomationVersionRequest,
  DeleteAutomationResponse,
  ListAutomationsResponse,
  UpdateAutomationRequest,
} from '../generated/types.gen';

type Dispatch = <T>(
  call: () => Promise<OperationResult<T>>,
  options?: RequestDispatchOptions
) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };
type AnyResponse = any;

export type ListAutomationsOptions = NonNullable<AutomationsListData['query']> & SignalOptions;

export class AutomationsResource {
  public readonly dataset: AutomationDatasetResource;
  public readonly datasetReviewRequests: AutomationDatasetReviewRequestsResource;
  public readonly examples: AutomationExamplesResource;
  public readonly evaluators: AutomationEvaluatorsResource;
  public readonly experiments: AutomationExperimentsResource;
  public readonly reviews: AutomationReviewsResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.dataset = new AutomationDatasetResource(client, dispatch);
    this.datasetReviewRequests = new AutomationDatasetReviewRequestsResource(client, dispatch);
    this.examples = new AutomationExamplesResource(client, dispatch);
    this.evaluators = new AutomationEvaluatorsResource(client, dispatch);
    this.experiments = new AutomationExperimentsResource(client, dispatch);
    this.reviews = new AutomationReviewsResource(client, dispatch);
  }

  async list(options: ListAutomationsOptions = {}): Promise<ListAutomationsResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() => automationsList({ client: this.client, query, signal }));
  }

  async get(id: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsGet({ client: this.client, path: { id }, signal: options.signal })
    );
  }

  /**
   * Move a YAML workflow between organizing folders. Agent automations have no
   * folder model and are rejected by the API.
   */
  async move(
    id: string,
    body: UpdateAutomationRequest,
    options: SignalOptions = {}
  ): Promise<AutomationDetail> {
    return this.dispatch(() =>
      automationsUpdate({
        client: this.client,
        path: { id },
        body,
        signal: options.signal,
      })
    );
  }

  /**
   * Delete a workflow or agent automation using the same cleanup as the dashboard.
   * Workflows archive the automations registry parent and keep execution history.
   * Agents delete the implementation, versions, and builder sessions, archive the
   * registry parent, and best-effort-delete agent storage; unified prior runs remain.
   */
  async delete(id: string, options: SignalOptions = {}): Promise<DeleteAutomationResponse> {
    return this.dispatch(() =>
      automationsDelete({ client: this.client, path: { id }, signal: options.signal })
    );
  }

  async versions(id: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsVersionsList({ client: this.client, path: { id }, signal: options.signal })
    );
  }

  async createVersion(
    id: string,
    body: CreateAutomationVersionRequest,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsVersionsCreate({
        client: this.client,
        path: { id },
        body,
        signal: options.signal,
      })
    );
  }

  async restoreVersion(
    id: string,
    versionId: string,
    body: { message?: string } = {},
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsVersionsRestore({
        client: this.client,
        path: { id, versionId },
        body,
        signal: options.signal,
      })
    );
  }

  async promoteVersion(
    id: string,
    versionId: string,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsVersionsPromote({
        client: this.client,
        path: { id, versionId },
        signal: options.signal,
      })
    );
  }

  async triggers(id: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsTriggersGet({ client: this.client, path: { id }, signal: options.signal })
    );
  }

  async sync(id: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsSync({ client: this.client, path: { id }, signal: options.signal })
    );
  }
}

type AutomationReviewHealthOptions = NonNullable<AutomationsReviewsHealthData['query']> &
  SignalOptions;

export class AutomationReviewsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async health(
    automationId: string,
    options: AutomationReviewHealthOptions = {}
  ): Promise<AnyResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      automationsReviewsHealth({
        client: this.client,
        path: { id: automationId },
        query,
        signal,
      })
    );
  }
}

export class AutomationDatasetResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async export(
    automationId: string,
    options: { exampleIds?: string[]; signal?: AbortSignal } = {}
  ): Promise<Blob> {
    const query = options.exampleIds?.length ? { exampleIds: options.exampleIds.join(',') } : {};
    return this.dispatch(
      () =>
        automationsDatasetExport({
          client: this.client,
          path: { id: automationId },
          query,
          signal: options.signal,
        }) as Promise<OperationResult<Blob>>
    );
  }

  async import(
    automationId: string,
    file: Blob | File,
    options: { mode?: 'append' | 'replace'; signal?: AbortSignal } = {}
  ): Promise<AnyResponse> {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('mode', options.mode ?? 'append');
    return this.dispatch(() =>
      automationsDatasetImport({
        client: this.client,
        path: { id: automationId },
        body: formData as never,
        bodySerializer: null,
        headers: { 'Content-Type': null },
        signal: options.signal,
      })
    );
  }
}

export class AutomationExamplesResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(
    automationId: string,
    options: {
      limit?: number;
      offset?: number;
      include?: 'full' | 'metadata';
      signal?: AbortSignal;
    } = {}
  ): Promise<AnyResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      automationsExamplesList({ client: this.client, path: { id: automationId }, query, signal })
    );
  }

  async create(
    automationId: string,
    body: Record<string, unknown>,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsExamplesCreate({
        client: this.client,
        path: { id: automationId },
        body: body as never,
        signal: options.signal,
      })
    );
  }

  async get(
    automationId: string,
    exampleId: string,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsExamplesGet({
        client: this.client,
        path: { id: automationId, exampleId },
        signal: options.signal,
      })
    );
  }

  async update(
    automationId: string,
    exampleId: string,
    body: Record<string, unknown>,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsExamplesUpdate({
        client: this.client,
        path: { id: automationId, exampleId },
        body: body as never,
        signal: options.signal,
      })
    );
  }

  async delete(
    automationId: string,
    exampleId: string,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsExamplesDelete({
        client: this.client,
        path: { id: automationId, exampleId },
        signal: options.signal,
      })
    );
  }

  async run(
    automationId: string,
    exampleId: string,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsExamplesRun({
        client: this.client,
        path: { id: automationId, exampleId },
        signal: options.signal,
      })
    );
  }
}

export class AutomationEvaluatorsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async get(automationId: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsEvaluatorsGet({
        client: this.client,
        path: { id: automationId },
        signal: options.signal,
      })
    );
  }

  async update(
    automationId: string,
    yaml: string,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsEvaluatorsUpdate({
        client: this.client,
        path: { id: automationId },
        body: { yaml },
        signal: options.signal,
      })
    );
  }
}

export class AutomationExperimentsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(
    automationId: string,
    options: { limit?: number; offset?: number; signal?: AbortSignal } = {}
  ): Promise<AnyResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      automationsExperimentsList({ client: this.client, path: { id: automationId }, query, signal })
    );
  }

  async create(
    automationId: string,
    body: Record<string, unknown> = {},
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsExperimentsCreate({
        client: this.client,
        path: { id: automationId },
        body: body as never,
        signal: options.signal,
      })
    );
  }

  async get(
    automationId: string,
    experimentId: string,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsExperimentsGet({
        client: this.client,
        path: { id: automationId, experimentId },
        signal: options.signal,
      })
    );
  }

  async cancel(
    automationId: string,
    experimentId: string,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsExperimentsCancel({
        client: this.client,
        path: { id: automationId, experimentId },
        signal: options.signal,
      })
    );
  }

  async export(
    automationId: string,
    experimentId: string,
    options: { format?: 'csv' | 'json'; signal?: AbortSignal } = {}
  ): Promise<string> {
    return this.dispatch(() =>
      automationsExperimentsExport({
        client: this.client,
        path: { id: automationId, experimentId },
        query: { format: options.format ?? 'csv' },
        parseAs: 'text',
        signal: options.signal,
      })
    );
  }

  async exportAll(
    automationId: string,
    options: { format?: 'csv' | 'json'; signal?: AbortSignal } = {}
  ): Promise<string> {
    return this.dispatch(() =>
      automationsExperimentsExportAll({
        client: this.client,
        path: { id: automationId },
        query: { format: options.format ?? 'csv' },
        parseAs: 'text',
        signal: options.signal,
      })
    );
  }

  async createStream(
    automationId: string,
    body: Record<string, unknown> = {},
    options: SignalOptions = {}
  ): Promise<ReadableStream<Uint8Array> | null> {
    return this.dispatch(
      () =>
        automationsExperimentsCreateStream({
          client: this.client,
          path: { id: automationId },
          body: body as never,
          parseAs: 'stream',
          signal: options.signal,
        }) as Promise<OperationResult<ReadableStream<Uint8Array> | null>>
    );
  }
}

type DatasetReviewItemStatus = 'pending' | 'approved' | 'edited' | 'rejected';
type DatasetReviewItemAction =
  | 'approve'
  | 'edit'
  | 'reject'
  | 'reopen'
  | 'comment'
  | 'field-decision'
  | 'file-decision'
  | 'edit-file';

function datasetReviewRequestsBaseUrl(automationId: string): string {
  return `/v1/automations/${automationId}/dataset-review-requests`;
}

function joinCsv(values: string | readonly string[] | undefined): string | undefined {
  if (values === undefined) return undefined;
  if (typeof values === 'string') return values;
  return values.join(',');
}

export type ListDatasetReviewRequestsOptions = SignalOptions & {
  status?: string | readonly string[];
  limit?: number;
  offset?: number;
};

export type DatasetReviewFocusField = {
  path: string;
  reason?: string | null;
};

export type DatasetReviewCreateItemNote = {
  exampleName: string;
  comment?: string | null;
  fields?: Array<{ path: string; comment: string }>;
};

export type CreateDatasetReviewRequestBody = {
  title: string;
  exampleNames: string[];
  instructions?: string | null;
  focusFields?: DatasetReviewFocusField[];
  ignoredFields?: string[];
  itemNotes?: DatasetReviewCreateItemNote[];
  status?: 'draft' | 'open' | 'paused';
};

export type UpdateDatasetReviewRequestBody = {
  title?: string;
  instructions?: string | null;
  focusFields?: DatasetReviewFocusField[];
  ignoredFields?: string[];
  status?: 'draft' | 'open' | 'paused' | 'closed';
};

export type UpdateDatasetReviewItemBody = {
  action: DatasetReviewItemAction;
  expected?: unknown;
  comment?: string | null;
  fieldPath?: string | null;
  /** Expected-file path for `file-decision`. */
  filePath?: string | null;
  /** Field decision for `field-decision`; pass `null` to clear. */
  decision?: 'approved' | 'rejected' | null;
  expectedUpdatedAt: string;
};

/** One entry of an item's expected-file overlay (`currentExpectedFiles`). */
export type DatasetReviewExpectedFile = {
  /** Expected-file path relative to the example `expected/` folder. */
  path: string;
  /**
   * Version id for the current bytes. Empty for snapshot-origin files, which
   * resolve by path.
   */
  fileId: string;
  filename: string;
  /**
   * Whether the current bytes are the snapshotted dataset file, a
   * reviewer-corrected version, or a brand-new reviewer upload.
   */
  origin: 'snapshot' | 'corrected' | 'uploaded';
};

/** Durable per-expected-file approve/reject, keyed by expected-file path. */
export type DatasetReviewFileDecision = {
  decision: 'approved' | 'rejected';
  comment?: string | null;
  reviewerId: string;
  updatedAt: string;
};

export type RecordDatasetReviewItemFileDecisionBody = {
  /** Expected-file path the decision applies to. */
  filePath: string;
  /**
   * File decision; pass `null` to clear a recorded decision. A comment
   * without a decision is a note — allowed only when a decision exists.
   */
  decision?: 'approved' | 'rejected' | null;
  comment?: string | null;
  expectedUpdatedAt: string;
};

export type EditDatasetReviewItemFileOptions = SignalOptions & {
  /** Correct an existing expected file. Exactly one of `filePath` / `newPath`. */
  filePath?: string;
  /** Upload a brand-new expected file. Exactly one of `filePath` / `newPath`. */
  newPath?: string;
  comment?: string;
  expectedUpdatedAt: string;
};

export class AutomationDatasetReviewRequestsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  async list(
    automationId: string,
    options: ListDatasetReviewRequestsOptions = {}
  ): Promise<AnyResponse> {
    const { signal, status, limit, offset } = options;
    const query = {
      status: joinCsv(status),
      limit,
      offset,
    };
    return this.dispatch(
      () =>
        this.client.get({
          url: datasetReviewRequestsBaseUrl(automationId),
          query,
          signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
  }

  async create(
    automationId: string,
    body: CreateDatasetReviewRequestBody,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(
      () =>
        this.client.post({
          url: datasetReviewRequestsBaseUrl(automationId),
          body: body as never,
          signal: options.signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
  }

  async get(
    automationId: string,
    reviewId: string,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(
      () =>
        this.client.get({
          url: `${datasetReviewRequestsBaseUrl(automationId)}/${reviewId}`,
          signal: options.signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
  }

  async update(
    automationId: string,
    reviewId: string,
    body: UpdateDatasetReviewRequestBody,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(
      () =>
        this.client.patch({
          url: `${datasetReviewRequestsBaseUrl(automationId)}/${reviewId}`,
          body: body as never,
          signal: options.signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
  }

  async listItems(
    automationId: string,
    reviewId: string,
    options: SignalOptions & { status?: string | readonly DatasetReviewItemStatus[] } = {}
  ): Promise<AnyResponse> {
    const { signal, status } = options;
    return this.dispatch(
      () =>
        this.client.get({
          url: `${datasetReviewRequestsBaseUrl(automationId)}/${reviewId}/items`,
          query: { status: joinCsv(status) },
          signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
  }

  async updateItem(
    automationId: string,
    reviewId: string,
    itemId: string,
    body: UpdateDatasetReviewItemBody,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(
      () =>
        this.client.patch({
          url: `${datasetReviewRequestsBaseUrl(automationId)}/${reviewId}/items/${itemId}`,
          body: body as never,
          signal: options.signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
  }

  async getItemFile(
    automationId: string,
    reviewId: string,
    itemId: string,
    path: string,
    options: SignalOptions & { kind?: 'input' | 'expected' } = {}
  ): Promise<Blob> {
    // Encode per segment: the path comes from snapshot manifests and may
    // contain spaces or unicode; encoding the whole string would escape the
    // separators the route needs to split on.
    const relative = path
      .replace(/^\/+/, '')
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const { kind, signal } = options;
    const suffix = kind === 'expected' ? '?kind=expected' : '';
    return this.dispatch(
      () =>
        this.client.get({
          url: `${datasetReviewRequestsBaseUrl(automationId)}/${reviewId}/items/${itemId}/files/${relative}${suffix}`,
          parseAs: 'blob',
          signal,
        }) as Promise<OperationResult<Blob>>,
      { responseKind: 'binary' }
    );
  }

  /**
   * Record a per-expected-file approve/reject (or a note) on a review item.
   * Pass `decision: null` to clear a recorded decision; a comment without a
   * decision is a note and requires an existing decision server-side.
   */
  async recordItemFileDecision(
    automationId: string,
    reviewId: string,
    itemId: string,
    body: RecordDatasetReviewItemFileDecisionBody,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(
      () =>
        this.client.patch({
          url: `${datasetReviewRequestsBaseUrl(automationId)}/${reviewId}/items/${itemId}`,
          body: { action: 'file-decision', ...body } as never,
          signal: options.signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
  }

  /**
   * Upload corrected bytes for an existing expected file (`filePath`) or a
   * brand-new reviewer upload (`newPath`). Multipart-only — mirrors the
   * dataset import's FormData passthrough. Replaces the item's expected-file
   * overlay entry and records a `file-edited` event.
   */
  async editItemFile(
    automationId: string,
    reviewId: string,
    itemId: string,
    file: Blob | File,
    options: EditDatasetReviewItemFileOptions
  ): Promise<AnyResponse> {
    const target = options.filePath ?? options.newPath ?? 'file';
    const fallbackName = target.split('/').pop() || 'file';
    const filename = file instanceof File && file.name ? file.name : fallbackName;
    const formData = new FormData();
    formData.set('action', 'edit-file');
    formData.set('file', file, filename);
    if (options.filePath !== undefined) formData.set('filePath', options.filePath);
    if (options.newPath !== undefined) formData.set('newPath', options.newPath);
    if (options.comment !== undefined) formData.set('comment', options.comment);
    formData.set('expectedUpdatedAt', options.expectedUpdatedAt);
    return this.dispatch(
      () =>
        this.client.patch({
          url: `${datasetReviewRequestsBaseUrl(automationId)}/${reviewId}/items/${itemId}`,
          body: formData as never,
          bodySerializer: null,
          headers: { 'Content-Type': null },
          signal: options.signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
  }

  async events(
    automationId: string,
    reviewId: string,
    options: SignalOptions = {}
  ): Promise<AnyResponse> {
    return this.dispatch(
      () =>
        this.client.get({
          url: `${datasetReviewRequestsBaseUrl(automationId)}/${reviewId}/events`,
          signal: options.signal,
        }) as Promise<OperationResult<AnyResponse>>
    );
  }
}
