import { ConfigEncryptor } from './encryption';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('ConfigEncryptor', () => {
  it('round-trips plaintext', () => {
    const enc = new ConfigEncryptor({ enabled: true, key: 'test-secret' });
    const cipher = enc.encrypt('super-secret');
    expect(cipher.startsWith('{cipher}v1:')).toBe(true);
    expect(enc.decrypt(cipher)).toBe('super-secret');
  });

  it('leaves non-cipher strings alone', () => {
    const enc = new ConfigEncryptor({ enabled: true, key: 'k' });
    expect(enc.decrypt('plain')).toBe('plain');
  });

  it('decrypts nested trees when enabled', () => {
    const enc = new ConfigEncryptor({ enabled: true, key: 'k' });
    const cipher = enc.encrypt('db-pass');
    const tree = enc.decryptTree({
      database: { password: cipher, host: 'localhost' },
      tags: [cipher, 'ok'],
    });
    expect(tree.database.password).toBe('db-pass');
    expect(tree.database.host).toBe('localhost');
    expect(tree.tags).toEqual(['db-pass', 'ok']);
  });

  it('does not decrypt trees when disabled', () => {
    const enc = new ConfigEncryptor({ enabled: false, key: 'k' });
    const cipher = new ConfigEncryptor({ enabled: true, key: 'k' }).encrypt('x');
    const tree = enc.decryptTree({ password: cipher });
    expect(tree.password).toBe(cipher);
  });

  it('throws when enabled without a key', () => {
    const prev = process.env.CONFIG_SERVER_ENCRYPT_KEY;
    delete process.env.CONFIG_SERVER_ENCRYPT_KEY;
    expect(() => new ConfigEncryptor({ enabled: true })).toThrow(/no key/);
    if (prev !== undefined) process.env.CONFIG_SERVER_ENCRYPT_KEY = prev;
  });

  it('reads key from a file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-key-'));
    const keyFile = path.join(dir, 'key.txt');
    fs.writeFileSync(keyFile, 'file-secret\n');
    const enc = new ConfigEncryptor({ enabled: true, keyFile });
    expect(enc.decrypt(enc.encrypt('hello'))).toBe('hello');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects malformed cipher payloads', () => {
    const enc = new ConfigEncryptor({ enabled: true, key: 'k' });
    expect(() => enc.decrypt('{cipher}v1:not-enough')).toThrow(/Malformed/);
    expect(() => enc.decrypt('{cipher}legacy')).toThrow(/Unsupported cipher/);
  });
});
