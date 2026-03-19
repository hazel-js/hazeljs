/// <reference types="jest" />
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ConfigService } from './config.service';
import { ConfigModule, ValidationSchema } from './config.module';

jest.mock('fs');
jest.mock('dotenv');
// Use __esModule: true so default import (`import logger from`) resolves correctly
jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Service: () => () => undefined,
  HazelModule: () => () => undefined,
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedDotenv = dotenv as jest.Mocked<typeof dotenv>;

describe('ConfigService', () => {
  beforeEach(() => {
    // Reset static options between tests
    ConfigService.setOptions({});
    // Clear mock call history
    jest.clearAllMocks();
    // Default: fs.existsSync returns false (no .env files)
    mockedFs.existsSync.mockReturnValue(false);
    // Default: dotenv.config returns empty parsed
    mockedDotenv.config.mockReturnValue({ parsed: {} });
  });

  describe('get()', () => {
    it('returns undefined for missing key', () => {
      const svc = new ConfigService();
      expect(svc.get('MISSING_KEY_HAZEL_TEST')).toBeUndefined();
    });

    it('returns default value for missing key', () => {
      const svc = new ConfigService();
      expect(svc.get('MISSING_KEY_HAZEL_TEST', 'default')).toBe('default');
    });

    it('returns value for existing env var', () => {
      process.env.__HAZEL_TEST_VAR__ = 'hello';
      const svc = new ConfigService();
      expect(svc.get('__HAZEL_TEST_VAR__')).toBe('hello');
      delete process.env.__HAZEL_TEST_VAR__;
    });
  });

  describe('set()', () => {
    it('sets a configuration value', () => {
      const svc = new ConfigService();
      svc.set('myKey', 'myValue');
      expect(svc.get('myKey')).toBe('myValue');
    });

    it('overwrites existing value', () => {
      const svc = new ConfigService();
      svc.set('myKey', 'first');
      svc.set('myKey', 'second');
      expect(svc.get('myKey')).toBe('second');
    });
  });

  describe('has()', () => {
    it('returns false for missing key', () => {
      const svc = new ConfigService();
      expect(svc.has('NO_SUCH_KEY_XYZ')).toBe(false);
    });

    it('returns true for existing key', () => {
      const svc = new ConfigService();
      svc.set('existingKey', 'val');
      expect(svc.has('existingKey')).toBe(true);
    });
  });

  describe('getAll()', () => {
    it('returns all configuration values', () => {
      const svc = new ConfigService();
      svc.set('k1', 'v1');
      svc.set('k2', 'v2');
      const all = svc.getAll();
      expect(all.k1).toBe('v1');
      expect(all.k2).toBe('v2');
    });

    it('returns a copy, not a reference', () => {
      const svc = new ConfigService();
      svc.set('k', 'v');
      const all = svc.getAll();
      all.k = 'mutated';
      expect(svc.get('k')).toBe('v');
    });
  });

  describe('getOrThrow()', () => {
    it('returns value when key exists', () => {
      const svc = new ConfigService();
      svc.set('req', 'present');
      expect(svc.getOrThrow('req')).toBe('present');
    });

    it('throws when key is missing', () => {
      const svc = new ConfigService();
      expect(() => svc.getOrThrow('DEFINITELY_NOT_SET_HAZEL')).toThrow(
        'Configuration key "DEFINITELY_NOT_SET_HAZEL" is required but not found'
      );
    });
  });

  describe('dot-notation nested keys', () => {
    it('resolves nested config via dot notation', () => {
      ConfigService.setOptions({
        ignoreEnvVars: true,
        ignoreEnvFile: true,
        load: [() => ({ database: { host: 'localhost', port: 5432 } })],
      });
      const svc = new ConfigService();
      expect(svc.get('database.host')).toBe('localhost');
      expect(svc.get('database.port')).toBe(5432);
    });

    it('returns undefined for missing nested key', () => {
      ConfigService.setOptions({
        ignoreEnvVars: true,
        ignoreEnvFile: true,
        load: [() => ({ database: { host: 'localhost' } })],
      });
      const svc = new ConfigService();
      expect(svc.get('database.missing')).toBeUndefined();
    });

    it('returns undefined when parent key does not exist', () => {
      ConfigService.setOptions({ ignoreEnvVars: true, ignoreEnvFile: true });
      const svc = new ConfigService();
      expect(svc.get('no.such.path')).toBeUndefined();
    });
  });

  describe('custom loaders', () => {
    it('merges custom loader config', () => {
      ConfigService.setOptions({
        ignoreEnvVars: true,
        ignoreEnvFile: true,
        load: [() => ({ APP_NAME: 'hazel' }), () => ({ APP_VERSION: '1.0.0' })],
      });
      const svc = new ConfigService();
      expect(svc.get('APP_NAME')).toBe('hazel');
      expect(svc.get('APP_VERSION')).toBe('1.0.0');
    });
  });

  describe('ignoreEnvVars', () => {
    it('skips loading process.env when ignoreEnvVars is true', () => {
      process.env.__HAZEL_IGNORE_TEST__ = 'should-not-appear';
      ConfigService.setOptions({ ignoreEnvVars: true, ignoreEnvFile: true });
      const svc = new ConfigService();
      expect(svc.get('__HAZEL_IGNORE_TEST__')).toBeUndefined();
      delete process.env.__HAZEL_IGNORE_TEST__;
    });
  });

  describe('ignoreEnvFile', () => {
    it('skips .env loading when ignoreEnvFile is true', () => {
      ConfigService.setOptions({ ignoreEnvFile: true });
      new ConfigService();
      expect(mockedFs.existsSync).not.toHaveBeenCalled();
    });
  });

  describe('.env file loading', () => {
    it('loads values from an existing .env file', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedDotenv.config.mockReturnValue({ parsed: { FROM_ENV_FILE: 'env-value' } });

      ConfigService.setOptions({ ignoreEnvVars: true, envFilePath: '/custom/.env' });
      const svc = new ConfigService();

      expect(mockedDotenv.config).toHaveBeenCalled();
      expect(svc.get('FROM_ENV_FILE')).toBe('env-value');
    });

    it('handles multiple env file paths', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedDotenv.config
        .mockReturnValueOnce({ parsed: { KEY_A: 'a' } })
        .mockReturnValueOnce({ parsed: { KEY_B: 'b' } });

      ConfigService.setOptions({
        ignoreEnvVars: true,
        envFilePath: ['/path/one.env', '/path/two.env'],
      });
      const svc = new ConfigService();

      expect(mockedDotenv.config).toHaveBeenCalledTimes(2);
      expect(svc.get('KEY_A')).toBe('a');
      expect(svc.get('KEY_B')).toBe('b');
    });

    it('handles dotenv parse errors gracefully', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedDotenv.config.mockReturnValue({ error: new Error('parse error') });
      // Should not throw
      ConfigService.setOptions({ ignoreEnvVars: true, envFilePath: '/bad.env' });
      expect(() => new ConfigService()).not.toThrow();
    });

    it('skips non-existent env files gracefully', () => {
      mockedFs.existsSync.mockReturnValue(false);
      ConfigService.setOptions({ ignoreEnvVars: true, envFilePath: '/missing.env' });
      expect(() => new ConfigService()).not.toThrow();
      expect(mockedDotenv.config).not.toHaveBeenCalled();
    });
  });

  describe('validation schema', () => {
    it('uses validated config value when validation passes', () => {
      const schema: ValidationSchema = {
        validate: (config) => ({
          value: { ...config, EXTRA_KEY: 'added-by-schema' },
        }),
      };
      ConfigService.setOptions({
        ignoreEnvVars: true,
        ignoreEnvFile: true,
        validationSchema: schema,
      });
      const svc = new ConfigService();
      expect(svc.get('EXTRA_KEY')).toBe('added-by-schema');
    });

    it('throws when validation fails and abortEarly is not set', () => {
      const schema: ValidationSchema = {
        validate: () => ({
          error: new Error('validation failed'),
          value: {},
        }),
      };
      ConfigService.setOptions({
        ignoreEnvVars: true,
        ignoreEnvFile: true,
        validationSchema: schema,
      });
      expect(() => new ConfigService()).toThrow(
        'Configuration validation error: validation failed'
      );
    });

    it('does not throw when validation fails and abortEarly is true', () => {
      const schema: ValidationSchema = {
        validate: () => ({
          error: new Error('validation failed'),
          value: {},
        }),
      };
      ConfigService.setOptions({
        ignoreEnvVars: true,
        ignoreEnvFile: true,
        validationSchema: schema,
        validationOptions: { abortEarly: true },
      });
      expect(() => new ConfigService()).not.toThrow();
    });
  });
});

describe('ConfigModule', () => {
  beforeEach(() => {
    ConfigService.setOptions({});
  });

  it('forRoot returns ConfigModule', () => {
    const result = ConfigModule.forRoot();
    expect(result).toBe(ConfigModule);
  });

  it('forRoot sets options on ConfigService', () => {
    ConfigModule.forRoot({ ignoreEnvFile: true, ignoreEnvVars: true });
    // If options were set, a new ConfigService should not try loading env files
    mockedFs.existsSync.mockReturnValue(false);
    expect(() => new ConfigService()).not.toThrow();
  });

  it('forRoot without options returns ConfigModule', () => {
    const result = ConfigModule.forRoot();
    expect(result).toBe(ConfigModule);
  });
});
