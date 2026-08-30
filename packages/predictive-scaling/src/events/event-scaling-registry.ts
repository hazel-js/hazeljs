import { ScaleOnEventOptions } from '../types';

export interface RegisteredScaleEvent extends ScaleOnEventOptions {
  scope: string;
}

/**
 * Registry for event-driven predictive scaling triggers.
 */
export class EventScalingRegistry {
  private static events = new Map<string, RegisteredScaleEvent[]>();

  static register(scope: string, options: ScaleOnEventOptions): void {
    const existing = this.events.get(scope) ?? [];
    existing.push({ ...options, scope });
    this.events.set(scope, existing);
  }

  static get(scope: string): RegisteredScaleEvent[] {
    return [...(this.events.get(scope) ?? [])];
  }

  static findMatching(eventName: string): RegisteredScaleEvent[] {
    const matches: RegisteredScaleEvent[] = [];
    for (const registrations of this.events.values()) {
      for (const registration of registrations) {
        if (registration.events.includes(eventName)) {
          matches.push(registration);
        }
      }
    }
    return matches;
  }

  static reset(): void {
    this.events.clear();
  }
}

export function calculateEventBoostReplicas(
  currentReplicas: number,
  options: ScaleOnEventOptions
): number {
  const factor = options.scaleFactor ?? 2;
  const maxScale = options.maxScale ?? 100;
  return Math.min(maxScale, Math.max(currentReplicas, Math.ceil(currentReplicas * factor)));
}
