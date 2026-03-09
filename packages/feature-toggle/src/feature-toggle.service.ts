import { Service } from '@hazeljs/core';
import { FeatureToggleModuleOptions } from './feature-toggle.types';

@Service()
export class FeatureToggleService {
  private static options: FeatureToggleModuleOptions = {};
  private readonly flags = new Map<string, boolean>();

  constructor() {
    this.load();
  }

  /**
   * Set module options (called by FeatureToggleModule.forRoot).
   */
  static setOptions(options: FeatureToggleModuleOptions): void {
    FeatureToggleService.options = options ?? {};
  }

  private load(): void {
    const opts = FeatureToggleService.options;

    if (opts.initialFlags) {
      for (const [name, value] of Object.entries(opts.initialFlags)) {
        this.flags.set(name, value);
      }
    }

    if (opts.envPrefix) {
      const prefix = opts.envPrefix.toUpperCase();
      for (const [key, raw] of Object.entries(process.env)) {
        if (key.startsWith(prefix) && raw !== undefined) {
          const name = this.envKeyToFlagName(key.slice(prefix.length));
          const value = this.parseBool(raw);
          this.flags.set(name, value);
        }
      }
    }
  }

  private envKeyToFlagName(envKey: string): string {
    // FEATURE_NEW_CHECKOUT -> newCheckout
    return envKey
      .toLowerCase()
      .split('_')
      .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('');
  }

  private parseBool(value: string): boolean {
    const v = value.toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }

  /**
   * Returns true if the feature is enabled, false otherwise.
   * Unset flags are treated as disabled.
   */
  isEnabled(name: string): boolean {
    return this.flags.get(name) ?? false;
  }

  /**
   * Get the raw value for a flag (undefined if not set).
   */
  get(name: string): boolean | undefined {
    return this.flags.has(name) ? this.flags.get(name) : undefined;
  }

  /**
   * Set or override a flag at runtime (in-memory only).
   */
  set(name: string, value: boolean): void {
    this.flags.set(name, value);
  }
}
