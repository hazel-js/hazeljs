/**
 * @Decision decorator — mirrors @Agent Reflect metadata pattern.
 */

import 'reflect-metadata';
import type { DecisionRiskInput, DecisionStrategyInput } from '../types';

export const DECISION_METADATA_KEY = Symbol('hazeljs:decision');

export interface DecisionDecoratorConfig {
  name: string;
  choices: readonly string[];
  objective?: string;
  risk?: DecisionRiskInput;
  provider?: string;
  strategy?: DecisionStrategyInput;
}

export interface DecisionMethodMetadata extends DecisionDecoratorConfig {
  target: object;
  methodName: string | symbol;
}

const GLOBAL_DECISION_METHODS: DecisionMethodMetadata[] = [];

export function Decision(config: DecisionDecoratorConfig): MethodDecorator {
  return ((target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata: DecisionMethodMetadata = {
      ...config,
      target,
      methodName: propertyKey,
    };
    Reflect.defineMetadata(DECISION_METADATA_KEY, metadata, target, propertyKey);
    GLOBAL_DECISION_METHODS.push(metadata);
    return descriptor;
  }) as MethodDecorator;
}

export function getRegisteredDecisionMethods(): DecisionMethodMetadata[] {
  return [...GLOBAL_DECISION_METHODS];
}

export function getDecisionMetadata(
  target: object,
  propertyKey: string | symbol
): DecisionMethodMetadata | undefined {
  return Reflect.getMetadata(DECISION_METADATA_KEY, target, propertyKey) as
    | DecisionMethodMetadata
    | undefined;
}
