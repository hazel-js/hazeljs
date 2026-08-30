import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import type { ConfigSource, GitOptions } from './types';
import { DEFAULT_LABEL } from './types';

const execFileAsync = promisify(execFile);

async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-c', 'credential.helper=', ...args], {
    cwd,
    timeout: 20_000,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'true',
      GIT_CONFIG_NOSYSTEM: '1',
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

function redactUri(uri: string): string {
  return uri.replace(/:\/\/([^/@]+)@/g, '://***@').replace(/:\/\/([^:]+):([^@]+)@/g, '://***@');
}

function withCredentials(uri: string, options: GitOptions): string {
  if (!options.username && !options.password) {
    return uri;
  }
  try {
    const parsed = new URL(uri);
    if (options.username) parsed.username = options.username;
    if (options.password) parsed.password = options.password;
    return parsed.toString();
  } catch {
    return uri;
  }
}

function normalizeUri(uri: string): string {
  if (uri.startsWith('file://')) {
    return uri;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(uri)) {
    return uri;
  }
  return path.resolve(uri);
}

export class GitConfigSource implements ConfigSource {
  private readonly options: GitOptions;
  readonly cloneDir: string;

  constructor(options: GitOptions) {
    if (!options.uri) {
      throw new Error('git.uri is required');
    }
    this.options = options;
    this.cloneDir =
      options.cloneDir ?? path.join(os.tmpdir(), `hazeljs-config-server-${cryptoRandom()}`);
  }

  async sync(label?: string): Promise<{ dir: string; version?: string; label: string }> {
    const resolvedLabel = label || this.options.defaultLabel || DEFAULT_LABEL;
    const uri = withCredentials(normalizeUri(this.options.uri), this.options);
    fs.mkdirSync(path.dirname(this.cloneDir), { recursive: true });

    if (!fs.existsSync(path.join(this.cloneDir, '.git'))) {
      if (fs.existsSync(this.cloneDir)) {
        fs.rmSync(this.cloneDir, { recursive: true, force: true });
      }
      await git(['clone', '--', uri, this.cloneDir]);
    } else {
      await git(['remote', 'set-url', 'origin', uri], this.cloneDir);
      await git(['fetch', 'origin'], this.cloneDir);
    }

    await git(['checkout', resolvedLabel], this.cloneDir).catch(async () => {
      await git(['checkout', '-B', resolvedLabel, `origin/${resolvedLabel}`], this.cloneDir);
    });

    const isDetached = await git(['rev-parse', '--abbrev-ref', 'HEAD'], this.cloneDir);
    if (isDetached !== 'HEAD') {
      await git(['pull', '--ff-only'], this.cloneDir).catch(() => undefined);
    }

    const version = await git(['rev-parse', 'HEAD'], this.cloneDir);
    return { dir: this.cloneDir, version, label: resolvedLabel };
  }

  async close(): Promise<void> {
    // Keep the clone so refresh is cheap. Callers may rmSync cloneDir if they own it.
  }

  describe(): string {
    return redactUri(withCredentials(normalizeUri(this.options.uri), this.options));
  }
}

export class FilesystemConfigSource implements ConfigSource {
  constructor(
    private readonly dir: string,
    private readonly defaultLabel = DEFAULT_LABEL
  ) {
    if (!dir) {
      throw new Error('nativePath is required');
    }
  }

  async sync(label?: string): Promise<{ dir: string; version?: string; label: string }> {
    if (!fs.existsSync(this.dir)) {
      throw new Error(`Config directory does not exist: ${this.dir}`);
    }
    return { dir: this.dir, label: label || this.defaultLabel };
  }
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 10);
}
