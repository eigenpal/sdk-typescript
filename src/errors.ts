import type { ApiErrorEnvelope } from './generated/types.gen';

/**
 * Base class for every error the SDK throws.
 *
 * Sub-classes are dispatched on HTTP status: `EigenpalAuthError` for 401,
 * `EigenpalForbiddenError` for 403, `EigenpalNotFoundError` for 404,
 * `EigenpalRateLimitError` for 429, `EigenpalServerError` for 5xx.
 * Validation failures (400) come back as `EigenpalValidationError` with
 * the parsed `issues[]` from the canonical `ApiErrorEnvelope`.
 */
export class EigenpalError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly envelope?: ApiErrorEnvelope;

  constructor(message: string, opts: { status: number; envelope?: ApiErrorEnvelope }) {
    super(message);
    this.name = 'EigenpalError';
    this.status = opts.status;
    this.requestId = opts.envelope?.requestId;
    this.envelope = opts.envelope;
  }
}

export class EigenpalAuthError extends EigenpalError {
  constructor(envelope?: ApiErrorEnvelope) {
    super('Missing or invalid API key', { status: 401, envelope });
    this.name = 'EigenpalAuthError';
  }
}

export class EigenpalForbiddenError extends EigenpalError {
  constructor(envelope?: ApiErrorEnvelope) {
    super(envelope?.issues?.[0]?.message ?? 'forbidden', { status: 403, envelope });
    this.name = 'EigenpalForbiddenError';
  }
}

export class EigenpalNotFoundError extends EigenpalError {
  constructor(envelope?: ApiErrorEnvelope) {
    super(envelope?.issues?.[0]?.message ?? 'not found', { status: 404, envelope });
    this.name = 'EigenpalNotFoundError';
  }
}

export class EigenpalValidationError extends EigenpalError {
  readonly issues: ApiErrorEnvelope['issues'];

  constructor(envelope: ApiErrorEnvelope) {
    const first = envelope.issues?.[0];
    super(first ? `${first.field}: ${first.message}` : 'validation error', {
      status: 400,
      envelope,
    });
    this.name = 'EigenpalValidationError';
    this.issues = envelope.issues;
  }
}

export class EigenpalRateLimitError extends EigenpalError {
  /** Seconds until the next request may succeed. From `Retry-After`. */
  readonly retryAfter?: number;

  constructor(envelope?: ApiErrorEnvelope, retryAfter?: number) {
    super('rate limit exceeded', { status: 429, envelope });
    this.name = 'EigenpalRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class EigenpalServerError extends EigenpalError {
  constructor(status: number, envelope?: ApiErrorEnvelope) {
    super(envelope?.issues?.[0]?.message ?? 'internal server error', { status, envelope });
    this.name = 'EigenpalServerError';
  }
}

export class EigenpalTimeoutError extends EigenpalError {
  constructor(message = 'operation timed out') {
    super(message, { status: 0 });
    this.name = 'EigenpalTimeoutError';
  }
}

/**
 * Map an HTTP response into the appropriate typed error. Used by the
 * `Eigenpal` facade to wrap raw fetch errors before they bubble to user
 * code.
 */
export function errorFromResponse(
  status: number,
  envelope: ApiErrorEnvelope | undefined,
  retryAfter?: number
): EigenpalError {
  if (status === 400) return new EigenpalValidationError(envelope ?? { issues: [], requestId: '' });
  if (status === 401) return new EigenpalAuthError(envelope);
  if (status === 403) return new EigenpalForbiddenError(envelope);
  if (status === 404) return new EigenpalNotFoundError(envelope);
  if (status === 429) return new EigenpalRateLimitError(envelope, retryAfter);
  if (status >= 500) return new EigenpalServerError(status, envelope);
  return new EigenpalError(`unexpected status ${status}`, { status, envelope });
}
