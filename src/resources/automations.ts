import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import {
  automationsDatasetExport,
  automationsDatasetImport,
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
  automationsSync,
  automationsTriggersGet,
  automationsVersionsList,
} from '../generated/sdk.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };
type AnyResponse = any;

export class AutomationsResource {
  public readonly dataset: AutomationDatasetResource;
  public readonly examples: AutomationExamplesResource;
  public readonly evaluators: AutomationEvaluatorsResource;
  public readonly experiments: AutomationExperimentsResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.dataset = new AutomationDatasetResource(client, dispatch);
    this.examples = new AutomationExamplesResource(client, dispatch);
    this.evaluators = new AutomationEvaluatorsResource(client, dispatch);
    this.experiments = new AutomationExperimentsResource(client, dispatch);
  }

  async list(
    options: {
      search?: string;
      type?: 'workflow' | 'agent';
      limit?: number;
      offset?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<AnyResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() => automationsList({ client: this.client, query, signal }));
  }

  async get(id: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsGet({ client: this.client, path: { id }, signal: options.signal })
    );
  }

  async versions(id: string, options: SignalOptions = {}): Promise<AnyResponse> {
    return this.dispatch(() =>
      automationsVersionsList({ client: this.client, path: { id }, signal: options.signal })
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
    options: { limit?: number; offset?: number; signal?: AbortSignal } = {}
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
