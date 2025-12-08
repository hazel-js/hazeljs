import 'reflect-metadata';
import { AIFunctionOptions } from '../ai-enhanced.types';
import logger from '@hazeljs/core';

const AI_FUNCTION_METADATA_KEY = 'hazel:ai:function';
const AI_PROMPT_METADATA_KEY = 'hazel:ai:prompt';

/**
 * AIFunction decorator for AI-powered methods
 *
 * @example
 * ```typescript
 * @AIFunction({
 *   provider: 'openai',
 *   model: 'gpt-4',
 *   streaming: true
 * })
 * async generateContent(@AIPrompt() prompt: string) {
 *   // Auto-handled by framework
 * }
 * ```
 */
export function AIFunction(options: AIFunctionOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const defaults: AIFunctionOptions = {
      streaming: false,
      temperature: 0.7,
      maxTokens: 1000,
      ...options,
    };

    Reflect.defineMetadata(AI_FUNCTION_METADATA_KEY, defaults, target, propertyKey);
    logger.debug(
      `AIFunction decorator applied to ${target.constructor.name}.${String(propertyKey)}`
    );

    return descriptor;
  };
}

/**
 * Get AI function metadata
 */
export function getAIFunctionMetadata(
  target: object,
  propertyKey: string | symbol
): AIFunctionOptions | undefined {
  return Reflect.getMetadata(AI_FUNCTION_METADATA_KEY, target, propertyKey);
}

/**
 * Check if method has AI function metadata
 */
export function hasAIFunctionMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(AI_FUNCTION_METADATA_KEY, target, propertyKey);
}

/**
 * AIPrompt parameter decorator
 *
 * @example
 * ```typescript
 * async generateContent(@AIPrompt() prompt: string) {
 *   // prompt parameter is marked for AI processing
 * }
 * ```
 */
export function AIPrompt(): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingParams = Reflect.getMetadata(AI_PROMPT_METADATA_KEY, target, propertyKey!) || [];
    existingParams[parameterIndex] = 'prompt';
    Reflect.defineMetadata(AI_PROMPT_METADATA_KEY, existingParams, target, propertyKey!);
  };
}

/**
 * Get AI prompt parameter metadata
 */
export function getAIPromptMetadata(target: object, propertyKey: string | symbol): number[] {
  const params = Reflect.getMetadata(AI_PROMPT_METADATA_KEY, target, propertyKey) || [];
  return params
    .map((p: string, index: number) => (p === 'prompt' ? index : -1))
    .filter((i: number) => i !== -1);
}
