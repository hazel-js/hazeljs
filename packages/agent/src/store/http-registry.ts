/**
 * HTTP client for Hazel Cloud hosted Agent OS package registry (Team SKU).
 *
 * Expected API (v1alpha):
 *   GET    /v1/health
 *   GET    /v1/packages?q=
 *   GET    /v1/packages/:name?version= | /v1/packages/:name/:version
 *   POST   /v1/packages
 *   DELETE /v1/packages/:name?version=
 *
 * Auth: Bearer token via Authorization header (HAZEL_REGISTRY_TOKEN).
 */

import { assertValidMarketplacePackage, type MarketplaceAgentPackage } from '../dna/agent-dna';
import type { PackageSummary } from './local-fs-registry';
import type { AgentPackageRegistry, RegistryDoctorReport } from './registry';

export type RegistryFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface HttpAgentPackageRegistryOptions {
  /** Base URL, e.g. https://registry.hazeljs.cloud */
  baseUrl: string;
  /** Bearer token (optional for public read endpoints). */
  token?: string;
  /** Inject fetch for tests. */
  fetch?: RegistryFetch;
  /** Request timeout ms (default 30000). */
  timeoutMs?: number;
}

export class HttpAgentPackageRegistry implements AgentPackageRegistry {
  readonly kind = 'remote' as const;
  readonly location: string;
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: RegistryFetch;
  private readonly timeoutMs: number;

  constructor(options: HttpAgentPackageRegistryOptions) {
    const trimmed = options.baseUrl.trim().replace(/\/+$/, '');
    if (!trimmed) throw new Error('HttpAgentPackageRegistry requires baseUrl');
    this.baseUrl = trimmed;
    this.location = trimmed;
    this.token = options.token?.trim() || undefined;
    this.fetchImpl = options.fetch ?? (fetch as RegistryFetch);
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'hazeljs-agent-registry/2.0',
    };
    if (json) h['Content-Type'] = 'application/json';
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; data: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(body !== undefined),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let data: unknown = undefined;
      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'message' in data
            ? String((data as { message: unknown }).message)
            : text || res.statusText;
        throw new Error(`Remote registry ${method} ${path} failed (${res.status}): ${msg}`);
      }
      return { status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  async publish(pkg: MarketplaceAgentPackage): Promise<void> {
    assertValidMarketplacePackage(pkg);
    await this.request('POST', '/v1/packages', pkg);
  }

  async get(name: string, version?: string): Promise<MarketplaceAgentPackage> {
    const encoded = encodeURIComponent(name);
    const path =
      version && version !== 'latest'
        ? `/v1/packages/${encoded}/${encodeURIComponent(version)}`
        : `/v1/packages/${encoded}`;
    const { data } = await this.request('GET', path);
    const pkg =
      data && typeof data === 'object' && 'package' in (data as object)
        ? (data as { package: MarketplaceAgentPackage }).package
        : (data as MarketplaceAgentPackage);
    assertValidMarketplacePackage(pkg);
    return pkg;
  }

  async list(query?: string): Promise<PackageSummary[]> {
    const q = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    const { data } = await this.request('GET', `/v1/packages${q}`);
    if (Array.isArray(data)) return data as PackageSummary[];
    if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as { packages?: unknown }).packages)
    ) {
      return (data as { packages: PackageSummary[] }).packages;
    }
    return [];
  }

  async remove(name: string, version?: string): Promise<void> {
    const encoded = encodeURIComponent(name);
    const q = version ? `?version=${encodeURIComponent(version)}` : '';
    await this.request('DELETE', `/v1/packages/${encoded}${q}`);
  }

  async doctor(): Promise<RegistryDoctorReport> {
    const checks: RegistryDoctorReport['checks'] = [];
    try {
      const { data, status } = await this.request('GET', '/v1/health');
      checks.push({
        name: 'remote_health',
        ok: status >= 200 && status < 300,
        detail: typeof data === 'object' ? JSON.stringify(data) : String(data ?? status),
      });
    } catch (e) {
      checks.push({
        name: 'remote_health',
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
    checks.push({
      name: 'remote_auth',
      ok: true,
      detail: this.token ? 'Bearer token configured' : 'no token (public read may still work)',
    });
    checks.push({
      name: 'remote_base',
      ok: true,
      detail: this.baseUrl,
    });
    return { ok: checks.every((c) => c.ok), checks };
  }
}

/**
 * Build a fetch mock backed by an in-memory registry (unit tests / local Cloud stub).
 */
export function createMemoryRegistryFetch(memory: {
  publish(pkg: MarketplaceAgentPackage): Promise<void>;
  get(name: string, version?: string): Promise<MarketplaceAgentPackage>;
  list(query?: string): Promise<PackageSummary[]>;
  remove(name: string, version?: string): Promise<void>;
  doctor(): Promise<RegistryDoctorReport>;
}): RegistryFetch {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.href;
    const method = (init?.method ?? 'GET').toUpperCase();
    const u = new URL(url);
    const pathname = u.pathname.replace(/\/+$/, '') || '/';

    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      if (method === 'GET' && pathname.endsWith('/v1/health')) {
        return json(200, { ok: true, service: 'hazel-agent-registry' });
      }
      if (method === 'GET' && /\/v1\/packages$/.test(pathname)) {
        const packages = await memory.list(u.searchParams.get('q') ?? undefined);
        return json(200, { packages });
      }
      if (method === 'POST' && /\/v1\/packages$/.test(pathname)) {
        const pkg = JSON.parse(String(init?.body ?? '{}')) as MarketplaceAgentPackage;
        await memory.publish(pkg);
        return json(201, { ok: true, package: pkg.name, version: pkg.version });
      }
      const getMatch = pathname.match(/\/v1\/packages\/([^/]+)(?:\/([^/]+))?$/);
      if (method === 'GET' && getMatch) {
        const name = decodeURIComponent(getMatch[1]!);
        const version = getMatch[2]
          ? decodeURIComponent(getMatch[2])
          : (u.searchParams.get('version') ?? undefined);
        const pkg = await memory.get(name, version ?? undefined);
        return json(200, pkg);
      }
      if (method === 'DELETE' && getMatch) {
        const name = decodeURIComponent(getMatch[1]!);
        const version = getMatch[2]
          ? decodeURIComponent(getMatch[2])
          : (u.searchParams.get('version') ?? undefined);
        await memory.remove(name, version ?? undefined);
        return json(200, { ok: true });
      }
      return json(404, { message: `No mock route for ${method} ${pathname}` });
    } catch (e) {
      return json(400, { message: e instanceof Error ? e.message : String(e) });
    }
  };
}
