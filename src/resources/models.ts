import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import { modelsList, modelsParserReadiness } from '../generated/sdk.gen';
import type { ListModelsResponse, ParsingReadiness } from '../generated/types.gen';

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;
type SignalOptions = { signal?: AbortSignal };

export class ModelsResource {
  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {}

  /** Catalog readiness for automatic parsing; run a document probe to verify live health. */
  async parserReadiness(options: SignalOptions = {}): Promise<ParsingReadiness> {
    return this.dispatch(() =>
      modelsParserReadiness({ client: this.client, signal: options.signal })
    );
  }

  /**
   * List text, vision, and OCR models configured for this tenant environment.
   * Catalog inventory only — not a live provider health probe.
   */
  async list(
    options: SignalOptions & { capability?: 'text' | 'vision' | 'ocr' } = {}
  ): Promise<ListModelsResponse> {
    return this.dispatch(() =>
      modelsList({
        client: this.client,
        query: { capability: options.capability },
        signal: options.signal,
      })
    );
  }
}
