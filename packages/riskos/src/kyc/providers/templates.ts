/**
 * Provider operation templates
 */

export interface HttpOperation {
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  retry?: { maxAttempts: number; backoffMs: number };
}
