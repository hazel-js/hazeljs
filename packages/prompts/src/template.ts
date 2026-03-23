/**
 * PromptTemplate<TVariables>
 *
 * A typed, reusable prompt template that interpolates named `{variable}`
 * placeholders with caller-supplied values.
 *
 * Supports:
 * - `{variable}` — simple substitution
 * - `{#if variable}...{/if}` — conditional blocks
 * - `{#each items}...{.}...{/each}` — iteration over arrays
 * - `{@include key}` — include another prompt from the registry
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
 *
 * Strict mode:
 * ```typescript
 * tpl.render({ query: 'test' }, { strict: true });
 * // throws: Missing required template variable: "context"
 * ```
 */

import type { PromptMetadata } from './types';

export interface RenderOptions {
  /**
   * When `true`, throws if any `{variable}` placeholder has no matching key
   * in the supplied variables object.
   * @default false
   */
  strict?: boolean;

  /**
   * Optional resolver for `{@include key}` directives.
   * When not provided, `{@include ...}` blocks are left as-is.
   * The PromptRegistry sets this automatically when calling `render()` through it.
   */
  includeResolver?: (key: string) => string | undefined;
}

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
   *   making missing variables easy to spot — or throws in `strict` mode.
   */
  render(variables: TVariables, options: RenderOptions = {}): string {
    const vars = variables as Record<string, unknown>;
    let result = this.template;

    // Step 1: Resolve {@include key} directives
    if (options.includeResolver) {
      const resolver = options.includeResolver;
      result = result.replace(/\{@include\s+([\w:.-]+)\}/g, (_match, key: string) => {
        const included = resolver(key);
        return included !== undefined ? included : _match;
      });
    }

    // Step 2: Process {#if variable}...{/if} blocks
    result = result.replace(
      /\{#if\s+(\w+)\}([\s\S]*?)\{\/if\}/g,
      (_match, key: string, body: string) => {
        const value = vars[key];
        // Truthy check: non-empty string, non-empty array, truthy value
        const isTruthy = Array.isArray(value)
          ? value.length > 0
          : value !== undefined && value !== null && value !== '' && value !== false;
        return isTruthy ? body : '';
      }
    );

    // Step 3: Process {#each items}...{.}...{/each} blocks
    result = result.replace(
      /\{#each\s+(\w+)\}([\s\S]*?)\{\/each\}/g,
      (_match, key: string, body: string) => {
        const value = vars[key];
        if (!Array.isArray(value)) return '';
        return value
          .map((item, index) => {
            let rendered = body.replace(/\{\.\}/g, String(item));
            rendered = rendered.replace(/\{@index\}/g, String(index));
            return rendered;
          })
          .join('');
      }
    );

    // Step 4: Strict mode — collect all remaining placeholders and check
    if (options.strict) {
      const placeholders = result.match(/\{(\w+)\}/g);
      if (placeholders) {
        const missing: string[] = [];
        for (const placeholder of placeholders) {
          const key = placeholder.slice(1, -1);
          if (vars[key] === undefined) {
            missing.push(key);
          }
        }
        if (missing.length > 0) {
          const unique = [...new Set(missing)];
          throw new Error(
            `[PromptTemplate] Missing required template variable${unique.length > 1 ? 's' : ''}: ` +
              `${unique.map((k) => `"${k}"`).join(', ')}. ` +
              `Template: "${this.metadata.name}" (v${this.metadata.version ?? 'latest'})`
          );
        }
      }
    }

    // Step 5: Variable substitution
    result = result.replace(/\{(\w+)\}/g, (match, key: string) => {
      const value = vars[key];
      return value !== undefined ? String(value) : match;
    });

    return result;
  }

  /**
   * Preview the rendered template — alias for `render()` with an estimated
   * token count appended for debugging.
   */
  preview(variables: TVariables, options: RenderOptions = {}): string {
    const rendered = this.render(variables, options);
    // Rough GPT tokenizer estimate: ~4 chars per token
    const estimatedTokens = Math.ceil(rendered.length / 4);
    return `${rendered}\n\n--- Preview: ~${estimatedTokens} tokens, ${rendered.length} chars ---`;
  }

  /**
   * Extract all placeholder variable names from the template.
   * Useful for introspection and validation.
   */
  variables(): string[] {
    const found = new Set<string>();
    // Simple placeholders
    for (const match of this.template.matchAll(/\{(\w+)\}/g)) {
      found.add(match[1]);
    }
    // Conditional keys
    for (const match of this.template.matchAll(/\{#if\s+(\w+)\}/g)) {
      found.add(match[1]);
    }
    // Each keys
    for (const match of this.template.matchAll(/\{#each\s+(\w+)\}/g)) {
      found.add(match[1]);
    }
    return [...found];
  }
}
