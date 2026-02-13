/**
 * Secrets resolution for provider config
 */

/** Resolve secret by key (e.g. from env) */
export type SecretResolver = (key: string) => string | undefined;

/** Default: resolve from process.env */
export const envSecretResolver: SecretResolver = (key: string) => process.env[key];
