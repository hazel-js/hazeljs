/**
 * Load project `.env` for hazeld / AgentOS via `@hazeljs/config` `loadEnvFiles`.
 * Soft-depends on `@hazeljs/config` (optional peer) — no-op when missing.
 */

/**
 * Load `<projectRoot>/.env` into process.env (does not override existing keys).
 * Returns absolute paths that were loaded.
 */
export function loadProjectEnv(projectRoot: string = process.cwd()): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadEnvFiles } = require('@hazeljs/config') as {
      loadEnvFiles: (opts: { cwd?: string; envFilePath?: string | string[] }) => {
        loaded: string[];
      };
    };
    return loadEnvFiles({ cwd: projectRoot, envFilePath: '.env' }).loaded;
  } catch {
    return [];
  }
}
