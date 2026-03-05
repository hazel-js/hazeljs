/**
 * PromptTemplate<TVariables>
 *
 * A typed, reusable prompt template that interpolates named `{variable}`
 * placeholders with caller-supplied values.
 *
 * Usage:
 * ```typescript
 * const tpl = new PromptTemplate<{ query: string; context: string }>(
 *   'Answer the question using the context.\nContext: {context}\nQuestion: {query}',
 *   { name: 'RAG Answer', version: '1.0.0' },
 * );
 *
 * const rendered = tpl.render({ query: 'What is TypeScript?', context: '...' });
 * ```
 */

import type { PromptMetadata } from './types';

export class PromptTemplate<TVariables extends object = Record<string, unknown>> {
  constructor(
    /** The raw template string containing `{variableName}` placeholders. */
    readonly template: string,
    /** Descriptive metadata — used for debugging and the registry. */
    readonly metadata: PromptMetadata
  ) {}

  /**
   * Render the template by substituting all `{key}` placeholders with the
   * corresponding values from `variables`.
   *
   * - If a placeholder key is present in `variables` its value is `String()`-cast.
   * - If a placeholder key is NOT present it is left as-is (e.g. `{missing}`),
   *   making missing variables easy to spot.
   */
  render(variables: TVariables): string {
    const vars = variables as Record<string, unknown>;
    return this.template.replace(/\{(\w+)\}/g, (match, key: string) => {
      const value = vars[key];
      return value !== undefined ? String(value) : match;
    });
  }
}
