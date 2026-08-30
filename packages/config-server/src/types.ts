/**
 * Options for the Git-backed config repository.
 */
export interface GitOptions {
  /** Remote URL, `file://` URI, or local path to a git repo */
  uri: string;
  /**
   * Path templates relative to the repo root.
   * Placeholders: `{application}`, `{profile}`, `{label}`
   * Example: `['configs/{application}/{profile}', 'configs/{application}']`
   */
  searchPaths?: string[];
  /** Branch or tag served when the client does not send a label. Default: `main` */
  defaultLabel?: string;
  /** Working copy directory. Defaults to a temp dir. */
  cloneDir?: string;
  /** HTTPS basic auth username */
  username?: string;
  /** HTTPS password or personal access token */
  password?: string;
}

export interface EncryptionOptions {
  enabled: boolean;
  /**
   * Passphrase or hex key. Hashed to 32 bytes with SHA-256.
   * Prefer `CONFIG_SERVER_ENCRYPT_KEY` in production.
   */
  key?: string;
  /** Path to a key file (first line is the key). */
  keyFile?: string;
}

export interface ConfigServerOptions {
  git?: GitOptions;
  /**
   * Serve config from a local directory without cloning.
   * Useful for tests and air-gapped installs.
   */
  nativePath?: string;
  searchPaths?: string[];
  profiles?: string[];
  encryption?: EncryptionOptions;
  /** HTTP listen port. Omit to use as a library only. */
  port?: number;
  host?: string;
  /** Periodic `git pull` / re-read interval in ms. 0 disables. */
  refreshInterval?: number;
  onAudit?: (event: AuditEvent) => void;
}

export interface ConfigClientOptions {
  /** Remote config-server base URL, e.g. `http://localhost:8888` */
  uri?: string;
  /** In-process server (embedded / tests) */
  server?: {
    getEnvironment(
      application: string,
      profiles?: string | string[],
      label?: string
    ): Promise<ConfigEnvironment>;
  };
  application: string;
  profiles?: string | string[];
  label?: string;
  /** Periodic refresh in ms. 0 disables. */
  refreshInterval?: number;
  failFast?: boolean;
}

export interface ConfigValueOptions {
  refresh?: boolean;
  default?: unknown;
  type?: 'string' | 'number' | 'boolean';
}

export interface PropertySource {
  name: string;
  source: Record<string, unknown>;
}

export interface ConfigEnvironment {
  name: string;
  profiles: string[];
  label: string;
  version?: string;
  propertySources: PropertySource[];
  /** Merged + decrypted view (later sources win) */
  config: Record<string, unknown>;
}

export type AuditAction =
  | 'clone'
  | 'pull'
  | 'sync'
  | 'resolve'
  | 'refresh'
  | 'encrypt'
  | 'decrypt'
  | 'http.fetch'
  | 'http.encrypt'
  | 'http.decrypt'
  | 'client.load'
  | 'client.refresh';

export interface AuditEvent {
  at: string;
  action: AuditAction;
  application?: string;
  profiles?: string[];
  label?: string;
  version?: string;
  path?: string;
  detail?: string;
}

export interface ConfigSource {
  sync(label?: string): Promise<{ dir: string; version?: string; label: string }>;
  close?(): Promise<void>;
}

export const CIPHER_PREFIX = '{cipher}';
export const DEFAULT_LABEL = 'main';
export const CONFIG_EXTENSIONS = ['.yml', '.yaml', '.json', '.properties', '.env'] as const;
