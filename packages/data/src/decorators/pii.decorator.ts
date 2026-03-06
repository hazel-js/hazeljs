import 'reflect-metadata';

/**
 * PII-safety decorators for pipeline methods.
 *
 * These decorators run **before** the decorated method executes,
 * modifying the data according to the specified operation.
 *
 * @Mask  — replaces field values with "****"
 * @Redact — removes fields entirely
 * @Encrypt — AES-256-GCM encrypts field values (Node.js crypto required)
 * @Decrypt — decrypts previously encrypted values
 */

const MASK_METADATA_KEY = 'hazel:data:pii:mask';
const REDACT_METADATA_KEY = 'hazel:data:pii:redact';
const ENCRYPT_METADATA_KEY = 'hazel:data:pii:encrypt';

// ─── @Mask ────────────────────────────────────────────────────────────────────

export interface MaskOptions {
  /** Fields to mask */
  fields: string[];
  /** Replacement string (default: "****") */
  replacement?: string;
  /** Show last N characters of the value (default: 0) */
  showLast?: number;
}

/**
 * Mask specified fields before the method runs.
 *
 * @example
 * @Transform({ step: 1, name: 'sanitize' })
 * @Mask({ fields: ['email', 'ssn'] })
 * sanitize(data: User) { return data; }
 */
export function Mask(fieldsOrOptions: string[] | MaskOptions): MethodDecorator {
  const options: MaskOptions = Array.isArray(fieldsOrOptions)
    ? { fields: fieldsOrOptions }
    : fieldsOrOptions;

  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(MASK_METADATA_KEY, options, target, propertyKey);

    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = function (data: unknown, ...rest: unknown[]): unknown {
      return original.call(this, applyMask(data, options), ...rest);
    };
    return descriptor;
  };
}

export function getMaskMetadata(target: object, key: string | symbol): MaskOptions | undefined {
  return Reflect.getMetadata(MASK_METADATA_KEY, target, key);
}

function applyMask(data: unknown, options: MaskOptions): unknown {
  const { fields, replacement = '****', showLast = 0 } = options;
  if (!data || typeof data !== 'object') return data;

  const result = { ...(data as Record<string, unknown>) };
  for (const field of fields) {
    const parts = field.split('.');
    maskNested(result, parts, replacement, showLast);
  }
  return result;
}

function maskNested(
  obj: Record<string, unknown>,
  path: string[],
  replacement: string,
  showLast: number
): void {
  if (path.length === 1) {
    const val = obj[path[0]];
    if (typeof val === 'string' && showLast > 0) {
      obj[path[0]] = replacement + val.slice(-showLast);
    } else if (val !== undefined && val !== null) {
      obj[path[0]] = replacement;
    }
    return;
  }
  const nested = obj[path[0]];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    maskNested(nested as Record<string, unknown>, path.slice(1), replacement, showLast);
  }
}

// ─── @Redact ──────────────────────────────────────────────────────────────────

export interface RedactOptions {
  fields: string[];
}

/**
 * Remove specified fields entirely before the method runs.
 *
 * @example
 * @Transform({ step: 2, name: 'redact' })
 * @Redact({ fields: ['password', 'secretToken'] })
 * redactSecrets(data: User) { return data; }
 */
export function Redact(fieldsOrOptions: string[] | RedactOptions): MethodDecorator {
  const options: RedactOptions = Array.isArray(fieldsOrOptions)
    ? { fields: fieldsOrOptions }
    : fieldsOrOptions;

  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(REDACT_METADATA_KEY, options, target, propertyKey);

    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = function (data: unknown, ...rest: unknown[]): unknown {
      return original.call(this, applyRedact(data, options), ...rest);
    };
    return descriptor;
  };
}

export function getRedactMetadata(target: object, key: string | symbol): RedactOptions | undefined {
  return Reflect.getMetadata(REDACT_METADATA_KEY, target, key);
}

function applyRedact(data: unknown, options: RedactOptions): unknown {
  if (!data || typeof data !== 'object') return data;
  const result = { ...(data as Record<string, unknown>) };
  for (const field of options.fields) {
    delete result[field];
  }
  return result;
}

// ─── @Encrypt ────────────────────────────────────────────────────────────────

export interface EncryptOptions {
  fields: string[];
  /** 32-byte AES-256-GCM key (hex string or Buffer) */
  key: string | Buffer;
  /** Optional AAD (additional authenticated data) for GCM */
  aad?: string;
}

export interface DecryptOptions {
  fields: string[];
  key: string | Buffer;
  aad?: string;
}

/**
 * AES-256-GCM encrypt specified fields before the method runs.
 * Encrypted values are stored as "iv:authTag:ciphertext" (all hex-encoded).
 *
 * @example
 * @Transform({ step: 3, name: 'encrypt-pii' })
 * @Encrypt({ fields: ['ssn', 'dob'], key: process.env.FIELD_ENCRYPTION_KEY! })
 * encryptPii(data: User) { return data; }
 */
export function Encrypt(options: EncryptOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(ENCRYPT_METADATA_KEY, options, target, propertyKey);

    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = function (data: unknown, ...rest: unknown[]): unknown {
      return original.call(this, applyEncrypt(data, options), ...rest);
    };
    return descriptor;
  };
}

function applyEncrypt(data: unknown, options: EncryptOptions): unknown {
  if (!data || typeof data !== 'object') return data;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const keyBuf = typeof options.key === 'string' ? Buffer.from(options.key, 'hex') : options.key;
  const result = { ...(data as Record<string, unknown>) };

  for (const field of options.fields) {
    const val = result[field];
    if (val === undefined || val === null) continue;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
    if (options.aad) cipher.setAAD(Buffer.from(options.aad));

    const plaintext = typeof val === 'string' ? val : JSON.stringify(val);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    result[field] = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  return result;
}

/**
 * Decrypt fields that were encrypted with @Encrypt.
 */
export function Decrypt(options: DecryptOptions): MethodDecorator {
  return (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = function (data: unknown, ...rest: unknown[]): unknown {
      return original.call(this, applyDecrypt(data, options), ...rest);
    };
    return descriptor;
  };
}

function applyDecrypt(data: unknown, options: DecryptOptions): unknown {
  if (!data || typeof data !== 'object') return data;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const keyBuf = typeof options.key === 'string' ? Buffer.from(options.key, 'hex') : options.key;
  const result = { ...(data as Record<string, unknown>) };

  for (const field of options.fields) {
    const val = result[field];
    if (typeof val !== 'string') continue;

    const parts = val.split(':');
    if (parts.length !== 3) continue;

    try {
      const [ivHex, authTagHex, ciphertextHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
      decipher.setAuthTag(authTag);
      if (options.aad) decipher.setAAD(Buffer.from(options.aad));

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        'utf8'
      );
      try {
        result[field] = JSON.parse(decrypted);
      } catch {
        result[field] = decrypted;
      }
    } catch {
      // Leave as-is if decryption fails
    }
  }

  return result;
}
