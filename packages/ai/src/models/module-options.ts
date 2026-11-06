import { AIProvider } from '../ai-enhanced.types';
import { AIError } from '../errors/ai.error';
import type { ContextAssemblerPort } from '../context/context-port';
import type {
  AIModuleCallDefaults,
  AIUsageListener,
  NamedAIModelDefinition,
  ResolvedNamedModel,
} from './model-registry.types';

export interface AIModuleOptions {
  defaultProvider?: AIProvider;
  providers?: AIProvider[];
  apiKeys?: Partial<Record<AIProvider, string>>;
  /** Named models. When set, names are validated at register time. */
  models?: Record<string, NamedAIModelDefinition>;
  defaults?: AIModuleCallDefaults;
  onUsage?: AIUsageListener;
  /**
   * Default duck-typed `@hazeljs/context` ContextService (or compatible port).
   * Used when a call passes `contextRequest` without an explicit `context` port.
   */
  contextService?: ContextAssemblerPort;
}

let options: AIModuleOptions = {};

export function setAIModuleOptions(next: AIModuleOptions): void {
  options = next;
}

export function getAIModuleOptions(): AIModuleOptions {
  return options;
}

export function validateNamedModels(models: Record<string, NamedAIModelDefinition>): void {
  for (const [name, def] of Object.entries(models)) {
    if (!def.provider || !def.model) {
      throw AIError.invalidRequest(`Model "${name}" must include provider and model fields`);
    }
    const fallbacks = normalizeFallback(def.fallback);
    for (const fb of fallbacks) {
      if (!models[fb]) {
        throw AIError.modelNotConfigured(fb);
      }
    }
  }
}

export function resolveNamedModel(name: string): ResolvedNamedModel {
  const models = options.models;
  if (!models || !models[name]) {
    throw AIError.modelNotConfigured(name);
  }
  const def = models[name];
  return {
    name,
    provider: def.provider,
    modelId: def.model,
    fallback: normalizeFallback(def.fallback),
    pricing: def.pricing,
    timeoutMs: def.timeoutMs ?? options.defaults?.timeoutMs,
    retry: def.retry ?? options.defaults?.retry,
    maxTokens: def.maxTokens ?? options.defaults?.maxTokens,
    temperature: def.temperature ?? options.defaults?.temperature,
  };
}

export function hasNamedModels(): boolean {
  return Boolean(options.models && Object.keys(options.models).length > 0);
}

export function listModelNames(): string[] {
  return Object.keys(options.models ?? {});
}

function normalizeFallback(fallback?: string | string[]): string[] {
  if (!fallback) return [];
  return Array.isArray(fallback) ? fallback : [fallback];
}
