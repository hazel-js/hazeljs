/**
 * Options for FeatureToggleModule.forRoot()
 */
export interface FeatureToggleModuleOptions {
  /**
   * Initial flag values to set on module load.
   */
  initialFlags?: Record<string, boolean>;

  /**
   * Environment variable prefix. When set, any env var like PREFIX_NAME
   * (e.g. FEATURE_NEW_UI) is read and stored as flag "newUi" (camelCase).
   * Values: 'true', '1', 'yes' (case-insensitive) => true; others => false.
   */
  envPrefix?: string;
}
