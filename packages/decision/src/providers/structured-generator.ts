/**
 * Duck-typed structured object generator (compatible with @hazeljs/ai generateObject).
 * Kept optional so the package does not hard-require a paid model API.
 */

import type { z } from 'zod';

export interface StructuredObjectGenerator {
  generateObject(
    prompt: string,
    schema: z.ZodTypeAny,
    options?: {
      provider?: string;
      model?: string;
      temperature?: number;
      maxRetries?: number;
    }
  ): Promise<unknown>;
}

export interface LlmStageUsage {
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
}
