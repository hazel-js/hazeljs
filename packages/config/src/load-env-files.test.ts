import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadEnvFiles } from './load-env-files';

describe('loadEnvFiles', () => {
  let tmp: string;
  const prev = process.env.__HAZEL_LOAD_ENV_TEST__;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-config-env-'));
    delete process.env.__HAZEL_LOAD_ENV_TEST__;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    if (prev === undefined) delete process.env.__HAZEL_LOAD_ENV_TEST__;
    else process.env.__HAZEL_LOAD_ENV_TEST__ = prev;
  });

  it('loads .env into process.env without overriding existing keys', () => {
    fs.writeFileSync(path.join(tmp, '.env'), '__HAZEL_LOAD_ENV_TEST__=from-file\n');
    process.env.__HAZEL_LOAD_ENV_TEST__ = 'already-set';
    const { loaded, parsed } = loadEnvFiles({ cwd: tmp });
    expect(loaded).toHaveLength(1);
    expect(parsed.__HAZEL_LOAD_ENV_TEST__).toBe('from-file');
    expect(process.env.__HAZEL_LOAD_ENV_TEST__).toBe('already-set');
  });

  it('applies values when unset', () => {
    fs.writeFileSync(path.join(tmp, '.env'), '__HAZEL_LOAD_ENV_TEST__=applied\n');
    const { loaded } = loadEnvFiles({ cwd: tmp });
    expect(loaded).toHaveLength(1);
    expect(process.env.__HAZEL_LOAD_ENV_TEST__).toBe('applied');
  });

  it('returns empty when .env is missing', () => {
    const { loaded, parsed } = loadEnvFiles({ cwd: tmp });
    expect(loaded).toEqual([]);
    expect(parsed).toEqual({});
  });
});
