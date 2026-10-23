/**
 * Local secrets — OS keychain (keytar) when available, else encrypted file.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ensureHazelHome, hazelHome } from './paths';

export interface SecretStore {
  set(name: string, value: string): Promise<void>;
  get(name: string): Promise<string | undefined>;
  delete(name: string): Promise<void>;
  /** Backend label for doctor. */
  backend?: string;
}

const ALGO = 'aes-256-gcm';
const KEYTAR_SERVICE = 'hazeljs-hazeld';

function deriveKey(home: string): Buffer {
  const keyPath = path.join(home, 'secrets', '.master');
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  if (!fs.existsSync(keyPath)) {
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key);
    try {
      fs.chmodSync(keyPath, 0o600);
    } catch {
      // windows
    }
  } else {
    try {
      fs.chmodSync(keyPath, 0o600);
    } catch {
      // windows
    }
  }
  return fs.readFileSync(keyPath);
}

export class EncryptedFileSecretStore implements SecretStore {
  readonly backend = 'encrypted-file';
  private readonly dir: string;
  private readonly key: Buffer;
  readonly masterKeyPath: string;

  constructor(home = hazelHome().home) {
    const paths = ensureHazelHome(hazelHome(home));
    this.dir = paths.secretsDir;
    this.masterKeyPath = path.join(paths.home, 'secrets', '.master');
    this.key = deriveKey(paths.home);
  }

  private fileFor(name: string): string {
    const safe = name.replace(/[^A-Za-z0-9._-]/g, '_');
    return path.join(this.dir, `${safe}.enc`);
  }

  async set(name: string, value: string): Promise<void> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, tag, enc]).toString('base64');
    const file = this.fileFor(name);
    fs.writeFileSync(file, payload);
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      // windows
    }
  }

  async get(name: string): Promise<string | undefined> {
    const file = this.fileFor(name);
    if (!fs.existsSync(file)) return undefined;
    const raw = Buffer.from(fs.readFileSync(file, 'utf8'), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  async delete(name: string): Promise<void> {
    const file = this.fileFor(name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

/** Optional keytar-backed store (soft peer). */
export class KeytarSecretStore implements SecretStore {
  readonly backend = 'keytar';

  constructor(
    private readonly keytar: {
      setPassword(service: string, account: string, password: string): Promise<void>;
      getPassword(service: string, account: string): Promise<string | null>;
      deletePassword(service: string, account: string): Promise<boolean>;
    },
    private readonly service = KEYTAR_SERVICE
  ) {}

  async set(name: string, value: string): Promise<void> {
    await this.keytar.setPassword(this.service, name, value);
  }

  async get(name: string): Promise<string | undefined> {
    const v = await this.keytar.getPassword(this.service, name);
    return v ?? undefined;
  }

  async delete(name: string): Promise<void> {
    await this.keytar.deletePassword(this.service, name);
  }
}

/**
 * Prefer OS keychain when `keytar` is installed; otherwise encrypted file under ~/.hazel/secrets.
 */
export function createSecretStore(home?: string): SecretStore {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as KeytarSecretStore['keytar'] & {
      setPassword: KeytarSecretStore['keytar']['setPassword'];
    };
    if (keytar && typeof keytar.setPassword === 'function') {
      return new KeytarSecretStore(keytar);
    }
  } catch {
    // optional peer missing
  }
  return new EncryptedFileSecretStore(home);
}
