/**
 * Production HTTP provider - real fetch with retry, timeout
 */

import type { HttpProvider } from './httpProvider';
import type { HttpOperation } from './templates';
import type { SecretResolver } from './secrets';
import { ProviderError } from '../../core/errors';

export interface FetchHttpProviderOptions {
  /** Base URL for the provider (e.g. https://api.complyadvantage.com) */
  baseUrl: string;
  /** Default request timeout in ms */
  timeoutMs?: number;
  /** Default retry config if not in operation */
  defaultRetry?: { maxAttempts: number; backoffMs: number };
  /** Header key for API key (e.g. Authorization) - value from resolveSecret(apiKeyEnvVar) */
  apiKeyHeader?: string;
  /** Env var name for API key when using apiKeyHeader */
  apiKeyEnvVar?: string;
}

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRY = { maxAttempts: 3, backoffMs: 1000 };

/** Sleep for backoff */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Build full URL from base + path + query */
function buildUrl(baseUrl: string, path: string, query?: Record<string, string>): string {
  const base = baseUrl.replace(/\/$/, '');
  const p = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query || Object.keys(query).length === 0) return p;
  const params = new URLSearchParams(query);
  return `${p}${p.includes('?') ? '&' : '?'}${params}`;
}

/** FetchHttpProvider - production-ready HTTP client */
export class FetchHttpProvider implements HttpProvider {
  constructor(
    public name: string,
    private options: FetchHttpProviderOptions,
  ) {}

  async call(
    operation: HttpOperation,
    state: Record<string, unknown>,
    resolveSecret?: SecretResolver,
  ): Promise<unknown> {
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT;

    const retry = operation.retry ?? this.options.defaultRetry ?? DEFAULT_RETRY;
    const url = buildUrl(this.options.baseUrl, operation.path, operation.query);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...operation.headers,
    };

    if (this.options.apiKeyHeader && this.options.apiKeyEnvVar && resolveSecret) {
      const key = resolveSecret(this.options.apiKeyEnvVar);
      if (key) headers[this.options.apiKeyHeader] = key.startsWith('Bearer ') ? key : `Bearer ${key}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
      try {
        const body = operation.body != null ? JSON.stringify(operation.body) : undefined;
        const res = await fetch(url, {
          method: operation.method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const text = await res.text();
          throw new ProviderError(
            `Provider ${this.name} returned ${res.status}: ${text.slice(0, 200)}`,
            this.name,
            res.status,
          );
        }

        const contentType = res.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await res.json();
        }
        return await res.text();
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (e instanceof ProviderError) throw e;
        if (attempt < retry.maxAttempts) {
          await sleep(retry.backoffMs * attempt);
        } else {
          throw new ProviderError(
            `Provider ${this.name} failed after ${retry.maxAttempts} attempts: ${lastError.message}`,
            this.name,
          );
        }
      }
    }

    clearTimeout(timeoutId);
    throw lastError ?? new ProviderError(`Provider ${this.name} failed`, this.name);
  }
}
