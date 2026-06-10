import type { OperationResult } from '../client';
import type { Client } from '../generated/client';
import { workflowsGet, workflowsList, workflowsVersionsList } from '../generated/sdk.gen';
import type {
  ListVersionsResponse,
  ListWorkflowsResponse,
  WorkflowDetail,
} from '../generated/types.gen';
import { WorkflowExecutionsResource } from './executions';

/**
 * Workflow inputs keyed by name as declared in the workflow YAML.
 *
 * File values (`File`, `Blob`, or `{ content, filename, mimeType }`) are
 * detected automatically and uploaded as `multipart/form-data` — same as
 * `curl -F`. No base64 round-trip required.
 */
export type WorkflowInput = Record<string, unknown>;

export interface ListWorkflowsOptions {
  /** Substring match against workflow name. */
  search?: string;
  /** Exact-match by workflow name (slug). */
  name?: string;
  kind?: 'workflow' | 'block';
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface ListVersionsOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

type Dispatch = <T>(call: () => Promise<OperationResult<T>>) => Promise<T>;

/**
 * Workflow resource — list, get, and inspect versions of saved workflows.
 * Existing run retrieval and mutation lives on `client.runs`.
 * Starting runs lives on root `client.run(...)`.
 */
export class WorkflowsResource {
  public readonly executions: WorkflowExecutionsResource;

  constructor(
    private readonly client: Client,
    private readonly dispatch: Dispatch
  ) {
    this.executions = new WorkflowExecutionsResource(client, dispatch);
  }

  /** List workflows, paginated. */
  async list(options: ListWorkflowsOptions = {}): Promise<ListWorkflowsResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() => workflowsList({ client: this.client, query, signal }));
  }

  /** Get a single workflow by id. Includes the current version's YAML. */
  async get(workflowId: string, options: { signal?: AbortSignal } = {}): Promise<WorkflowDetail> {
    return this.dispatch(() =>
      workflowsGet({ client: this.client, path: { id: workflowId }, signal: options.signal })
    );
  }

  /** List tagged versions for a workflow, paginated. */
  async versions(
    workflowId: string,
    options: ListVersionsOptions = {}
  ): Promise<ListVersionsResponse> {
    const { signal, ...query } = options;
    return this.dispatch(() =>
      workflowsVersionsList({
        client: this.client,
        path: { id: workflowId },
        query,
        signal,
      })
    );
  }
}
