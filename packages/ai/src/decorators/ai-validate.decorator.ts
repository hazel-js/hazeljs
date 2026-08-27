import 'reflect-metadata';
import { AIValidationOptions } from '../ai-enhanced.types';
import logger from '@hazeljs/core';

const AI_VALIDATE_METADATA_KEY = 'hazel:ai:validate';

/**
 * AIValidate decorator for AI-powered validation
 *
 * @example
 * ```typescript
 * @AIValidate({
 *   provider: 'openai',
 *   instruction: 'Validate if this is a professional email'
 * })
 * export class ContactDto {
 *   @IsEmail()
 *   email: string;
 * }
 * ```
 */
export function AIValidate(options: AIValidationOptions): ClassDecorator {
  return (target: object) => {
    const defaults: AIValidationOptions = {
      model: 'gpt-3.5-turbo',
      failOnInvalid: true,
      ...options,
    };

    Reflect.defineMetadata(AI_VALIDATE_METADATA_KEY, defaults, target);
    const className = (target as { name?: string }).name || 'Unknown';
    logger.debug(`AIValidate decorator applied to ${className}`);
  };
}

/**
 * Get AI validation metadata
 */
export function getAIValidationMetadata(target: object): AIValidationOptions | undefined {
  return Reflect.getMetadata(AI_VALIDATE_METADATA_KEY, target);
}

/**
 * Check if class has AI validation metadata
 */
export function hasAIValidationMetadata(target: object): boolean {
  return Reflect.hasMetadata(AI_VALIDATE_METADATA_KEY, target);
}

/**
 * AIValidateProperty decorator for property-level validation
 *
 * @example
 * ```typescript
 * export class UserDto {
 *   @AIValidateProperty({
 *     provider: 'openai',
 *     instruction: 'Check if this username is appropriate'
 *   })
 *   username: string;
 * }
 * ```
 */
export function AIValidateProperty(options: AIValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const defaults: AIValidationOptions = {
      model: 'gpt-3.5-turbo',
      failOnInvalid: true,
      ...options,
    };

    Reflect.defineMetadata(`${AI_VALIDATE_METADATA_KEY}:${String(propertyKey)}`, defaults, target);
    logger.debug(
      `AIValidateProperty decorator applied to ${target.constructor.name}.${String(propertyKey)}`
    );
  };
}

/**
 * Get AI property validation metadata
 */
export function getAIPropertyValidationMetadata(
  target: object,
  propertyKey: string | symbol
): AIValidationOptions | undefined {
  return Reflect.getMetadata(`${AI_VALIDATE_METADATA_KEY}:${String(propertyKey)}`, target);
}
