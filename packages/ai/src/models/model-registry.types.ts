import type { AIProvider } from '../ai-enhanced.types';

/** Dollars (or unit of choice) per million tokens. */
export interface AIModelPricing {
  input: number;
  output: number;
  cachedInput?: number;
}

export interface AIRetryDefaults {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  backoff?: {
    delayMs?: number;
    factor?: number;
    maxDelayMs?: number;
    jitter?: boolean;
  };
}

export interface AICallBudget {
  maxTokens?: number;
  maxCost?: number;
}

export interface NamedAIModelDefinition {
  provider: AIProvider;
  model: string;
  /** Fallback model registry name(s). Only the primary model's fallback is followed. */
  fallback?: string | string[];
  pricing?: AIModelPricing;
  timeoutMs?: number;
  retry?: AIRetryDefaults;
  maxTokens?: number;
  temperature?: number;
}

export interface AIModuleCallDefaults {
  timeoutMs?: number;
  retry?: AIRetryDefaults;
  maxSteps?: number;
  budget?: AICallBudget;
  maxTokens?: number;
  temperature?: number;
}

export type AIUsageListener = (event: {
  label?: string;
  model: { name?: string; provider: AIProvider; modelId: string };
  step: number;
  attempt: number;
  fallback: boolean;
  stream: boolean;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedInputTokens?: number;
  };
  cost?: number;
  durationMs: number;
  finishReason?: string;
}) => void;

export interface ResolvedNamedModel {
  name: string;
  provider: AIProvider;
  modelId: string;
  fallback: string[];
  pricing?: AIModelPricing;
  timeoutMs?: number;
  retry?: AIRetryDefaults;
  maxTokens?: number;
  temperature?: number;
}
