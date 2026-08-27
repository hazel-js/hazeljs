/**
 * @Speculate — fork K reasoning branches with commit/rollback semantics.
 */

import 'reflect-metadata';

export const SPECULATE_METADATA_KEY = Symbol('hazel:agent-vm:speculate');

export type SpeculateScorer = 'heuristic' | 'llm-judge' | 'custom';

export interface SpeculateMetadata {
  branches: number;
  scorer?: SpeculateScorer;
  /** Early pruning strategy */
  prune?: 'none' | 'budget' | 'score';
  /** Max concurrent branches */
  concurrency?: number;
  /** Barrier mode when irreversible tool is hit */
  barrierMode?: 'converge' | 'abort' | 'store-buffer';
  enableStoreBuffer?: boolean;
}

export function Speculate(options: SpeculateMetadata): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata(SPECULATE_METADATA_KEY, options, target, propertyKey);
  };
}

export function getSpeculateMetadata(
  target: object,
  propertyKey: string | symbol
): SpeculateMetadata | undefined {
  return Reflect.getMetadata(SPECULATE_METADATA_KEY, target, propertyKey);
}
