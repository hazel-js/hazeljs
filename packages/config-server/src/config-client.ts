import * as http from 'http';
import * as https from 'https';
import type { ConfigClientOptions, ConfigEnvironment } from './types';
import { DEFAULT_LABEL } from './types';
import { getNested } from './merge';

export type ConfigChangeListener = (env: ConfigEnvironment) => void;

function normalizeProfiles(profiles?: string | string[]): string[] {
  if (!profiles) return ['default'];
  const list = Array.isArray(profiles) ? profiles : profiles.split(',');
  const out = list.map((p) => p.trim()).filter(Boolean);
  return out.length ? out : ['default'];
}

function httpGetJson(url: string): Promise<ConfigEnvironment> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk as Buffer));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if ((res.statusCode ?? 500) >= 400) {
          reject(new Error(`Config server returned ${res.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body) as ConfigEnvironment);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
  });
}

export class ConfigClient {
  private static instance?: ConfigClient;
  private static pendingOptions?: ConfigClientOptions;
  private readonly options: ConfigClientOptions;
  private env?: ConfigEnvironment;
  private timer?: NodeJS.Timeout;
  private readonly listeners = new Set<ConfigChangeListener>();

  static getInstance(): ConfigClient {
    if (!ConfigClient.instance) {
      throw new Error(
        'ConfigClient has not been loaded. Call ConfigServerModule.forClient() or `await new ConfigClient(options).load()`.'
      );
    }
    return ConfigClient.instance;
  }

  static resetInstance(): void {
    ConfigClient.instance = undefined;
  }

  static configure(options: ConfigClientOptions): void {
    ConfigClient.pendingOptions = options;
  }

  constructor(options?: ConfigClientOptions) {
    const resolved = options ?? ConfigClient.pendingOptions;
    if (!resolved) {
      throw new Error(
        'ConfigClient requires options (constructor or ConfigServerModule.forClient)'
      );
    }
    if (!resolved.uri && !resolved.server) {
      throw new Error('ConfigClient requires uri or an in-process server');
    }
    if (!resolved.application) {
      throw new Error('ConfigClient.application is required');
    }
    this.options = resolved;
    ConfigClient.instance = this;
  }

  async load(): Promise<ConfigEnvironment> {
    this.env = await this.fetch();
    const interval = this.options.refreshInterval ?? 0;
    if (interval > 0 && !this.timer) {
      this.timer = setInterval(() => {
        void this.refresh().catch(() => undefined);
      }, interval);
      this.timer.unref();
    }
    return this.env;
  }

  async refresh(): Promise<ConfigEnvironment> {
    this.env = await this.fetch();
    for (const listener of this.listeners) {
      listener(this.env);
    }
    return this.env;
  }

  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (ConfigClient.instance === this) {
      ConfigClient.resetInstance();
    }
  }

  onChange(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get<T = unknown>(key: string): T | undefined;
  get<T = unknown>(key: string, defaultValue: T): T;
  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    if (!this.env) {
      if (this.options.failFast) {
        throw new Error('ConfigClient has not loaded yet. Call load() first.');
      }
      return defaultValue;
    }
    const value = getNested(this.env.config, key);
    return value !== undefined ? (value as T) : defaultValue;
  }

  getOrThrow<T = unknown>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new Error(`Configuration key "${key}" is required but not found`);
    }
    return value;
  }

  getAll(): Record<string, unknown> {
    return { ...(this.env?.config ?? {}) };
  }

  getEnvironment(): ConfigEnvironment | undefined {
    return this.env;
  }

  private async fetch(): Promise<ConfigEnvironment> {
    const profiles = normalizeProfiles(this.options.profiles);
    const label = this.options.label || DEFAULT_LABEL;
    if (this.options.server) {
      return this.options.server.getEnvironment(this.options.application, profiles, label);
    }
    const base = (this.options.uri as string).replace(/\/+$/, '');
    const path = `/${encodeURIComponent(this.options.application)}/${encodeURIComponent(profiles.join(','))}/${encodeURIComponent(label)}`;
    return httpGetJson(`${base}${path}`);
  }
}
