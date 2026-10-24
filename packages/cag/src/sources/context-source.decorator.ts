import 'reflect-metadata';
import type { ContextLoadInput } from '../types';

export const CONTEXT_SOURCE_METADATA = 'hazel:cag:context-source';

export interface ContextSourceOptions {
  namespace: string;
  ttl?: number | string;
  priority?: number;
  compressible?: boolean;
  id?: string;
}

export interface ContextSourceClass {
  load(input: ContextLoadInput): Promise<string> | string;
}

/**
 * Declarative context source. Metadata is read when the class is listed in
 * CagModule.forRoot({ sources }) or registered via CagService.registerClass().
 * No filesystem scan.
 */
export function ContextSource(options: ContextSourceOptions): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(CONTEXT_SOURCE_METADATA, options, target);
  };
}

export function getContextSourceMetadata(target: unknown): ContextSourceOptions | undefined {
  if (typeof target !== 'function') return undefined;
  return Reflect.getMetadata(CONTEXT_SOURCE_METADATA, target) as ContextSourceOptions | undefined;
}
