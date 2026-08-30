import * as crypto from 'crypto';
import * as fs from 'fs';
import { CIPHER_PREFIX, type EncryptionOptions } from './types';
import { walkStrings } from './merge';

const PREFIX = `${CIPHER_PREFIX}v1:`;

export class ConfigEncryptor {
  private readonly key: Buffer;
  readonly enabled: boolean;

  constructor(options?: EncryptionOptions) {
    this.enabled = Boolean(options?.enabled);
    const secret = options?.keyFile
      ? fs.readFileSync(options.keyFile, 'utf8').split(/\r?\n/)[0].trim()
      : (options?.key ?? process.env.CONFIG_SERVER_ENCRYPT_KEY);
    if (this.enabled && !secret) {
      throw new Error(
        'Encryption is enabled but no key was provided. Set encryption.key, encryption.keyFile, or CONFIG_SERVER_ENCRYPT_KEY.'
      );
    }
    this.key = crypto
      .createHash('sha256')
      .update(secret ?? 'disabled')
      .digest();
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  decrypt(value: string): string {
    if (!value.startsWith(CIPHER_PREFIX)) {
      return value;
    }
    if (!value.startsWith(PREFIX)) {
      throw new Error('Unsupported cipher payload (expected {cipher}v1:...)');
    }
    const payload = value.slice(PREFIX.length);
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed cipher payload');
    }
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivB64, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  decryptTree<T>(value: T): T {
    if (!this.enabled) {
      return value;
    }
    return walkStrings(value, (s) => (s.startsWith(CIPHER_PREFIX) ? this.decrypt(s) : s)) as T;
  }
}
