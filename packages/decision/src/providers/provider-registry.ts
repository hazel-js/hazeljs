/**
 * Provider registry + auto routing extension point.
 */

import { DecisionProviderError, DecisionValidationError } from '../errors';
import type { DecisionProvider } from './decision-provider';
import type { DecisionRiskObject } from '../types';

export type ProviderRouterHook = (input: {
  requested?: string;
  risk: DecisionRiskObject;
  name?: string;
  available: string[];
}) => string;

export class DecisionProviderRegistry {
  private readonly providers = new Map<string, DecisionProvider>();
  private routerHook?: ProviderRouterHook;

  register(provider: DecisionProvider): void {
    this.providers.set(provider.name, provider);
  }

  setRouterHook(hook: ProviderRouterHook): void {
    this.routerHook = hook;
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  list(): string[] {
    return [...this.providers.keys()];
  }

  get(name: string): DecisionProvider {
    const p = this.providers.get(name);
    if (!p) {
      throw new DecisionProviderError(`Decision provider not registered: ${name}`, {
        available: this.list(),
      });
    }
    return p;
  }

  resolve(
    requested: string | undefined,
    risk: DecisionRiskObject,
    name?: string
  ): DecisionProvider {
    if (!requested || requested === 'auto') {
      const available = this.list();
      const chosen = this.routerHook
        ? this.routerHook({ requested, risk, name, available })
        : available.includes('hazel-agent')
          ? 'hazel-agent'
          : available[0];
      if (!chosen) {
        throw new DecisionValidationError('No decision providers registered');
      }
      return this.get(chosen);
    }
    return this.get(requested);
  }
}
