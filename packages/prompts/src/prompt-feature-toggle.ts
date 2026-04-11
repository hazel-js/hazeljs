/**
 * Optional A/B wiring between PromptRegistry and @hazeljs/feature-toggle.
 * Peer dependency only — import when both packages are installed.
 */

import type { PromptTemplate } from './template';
import { PromptRegistry } from './registry';

export type FeatureToggleFn = (key: string) => boolean | Promise<boolean>;

export interface PromptExperimentOptions {
  /** Feature flag key — when true, `variant` prompt is used */
  flagKey: string;
  /** Baseline prompt key in the registry */
  controlKey: string;
  /** Alternative prompt key when the flag is on */
  variantKey: string;
  isEnabled: FeatureToggleFn;
}

/**
 * Resolve a prompt for an experiment: control vs variant based on feature flag.
 */
export async function resolvePromptForExperiment(
  options: PromptExperimentOptions
): Promise<PromptTemplate> {
  const enabled = await options.isEnabled(options.flagKey);
  const key = enabled ? options.variantKey : options.controlKey;
  return PromptRegistry.get(key);
}
