import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig } from '../src/config.js';

describe('getConfig', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('returns config from env', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.PORT = '4000';
    const config = getConfig();
    expect(config.databaseUrl).toBe('postgresql://localhost/test');
    expect(config.port).toBe(4000);
  });

  it('uses default port 3000 when PORT not set', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    delete process.env.PORT;
    const config = getConfig();
    expect(config.port).toBe(3000);
  });

  it('returns undefined databaseUrl when DATABASE_URL not set (in-memory mode)', () => {
    delete process.env.DATABASE_URL;
    const config = getConfig();
    expect(config.databaseUrl).toBeUndefined();
    expect(config.port).toBe(3000);
  });
});
