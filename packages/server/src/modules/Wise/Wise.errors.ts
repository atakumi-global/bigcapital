/**
 * Thrown when the Wise API rejects the configured token (401) or the token
 * lacks access to the requested resource (403). Non-retryable: requires
 * operator intervention (new token / different profile).
 */
export class WiseAuthError extends Error {
  constructor(message = 'Wise API authentication/authorization failed.') {
    super(message);
    this.name = 'WiseAuthError';
  }
}

/**
 * Thrown when the Wise API rate-limits the request (429). Retryable after
 * the `Retry-After` window.
 */
export class WiseRateLimitError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(message = 'Wise API rate limit exceeded.', retryAfter?: number) {
    super(message);
    this.name = 'WiseRateLimitError';
    this.retryAfterSeconds = retryAfter;
  }
}

/**
 * Thrown on Wise 5xx responses. Retryable with backoff.
 */
export class WiseTransientError extends Error {
  constructor(message = 'Wise API transient error.') {
    super(message);
    this.name = 'WiseTransientError';
  }
}
