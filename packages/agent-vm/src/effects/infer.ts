/**
 * Infer effect kind from @Tool metadata when no explicit effect decorator is set.
 */

import type { ToolMetadata } from '@hazeljs/agent';
import { DEFAULT_EFFECT_KIND, EffectKind } from './effect-kind';
import { getEffectMetadata } from './effect.decorator';

export function inferEffectKind(tool: ToolMetadata): EffectKind {
  const target = tool.target as object;
  const explicit =
    getEffectMetadata(target, tool.propertyKey) ??
    getEffectMetadata(Object.getPrototypeOf(target), tool.propertyKey);
  if (explicit?.kind) {
    return explicit.kind;
  }

  if (tool.readOnly === true) {
    return EffectKind.READ;
  }

  return DEFAULT_EFFECT_KIND;
}

export function getCompensateMethodName(tool: ToolMetadata): string | undefined {
  const target = tool.target as object;
  const explicit =
    getEffectMetadata(target, tool.propertyKey) ??
    getEffectMetadata(Object.getPrototypeOf(target), tool.propertyKey);
  return explicit?.compensate;
}

export function getPredictFn(
  tool: ToolMetadata
): ((input: Record<string, unknown>) => unknown) | undefined {
  const target = tool.target as object;
  const explicit =
    getEffectMetadata(target, tool.propertyKey) ??
    getEffectMetadata(Object.getPrototypeOf(target), tool.propertyKey);
  return explicit?.predict;
}
