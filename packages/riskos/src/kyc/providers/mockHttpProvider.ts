/**
 * Mock HTTP provider for testing - returns configurable mock responses
 */

import type { HttpProvider } from './httpProvider';
import type { HttpOperation } from './templates';

export interface MockHttpProviderOptions {
  /** Mock response for any call */
  mockResponse?: unknown;
  /** Per-path mock responses */
  pathResponses?: Record<string, unknown>;
}

export class MockHttpProvider implements HttpProvider {
  constructor(
    public name: string,
    private options: MockHttpProviderOptions = {}
  ) {}

  async call(
    operation: HttpOperation,
    _state: Record<string, unknown>,
    _resolveSecret?: (key: string) => string | undefined
  ): Promise<unknown> {
    if (this.options.pathResponses?.[operation.path]) {
      return this.options.pathResponses[operation.path];
    }
    return this.options.mockResponse ?? { match: false, status: 'no_hit' };
  }
}
