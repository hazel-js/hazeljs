/**
 * GitHubLoader
 *
 * Loads files from a GitHub repository using the GitHub REST API.
 * No extra npm dependency required — uses Node.js built-in `fetch`.
 *
 * Supports:
 *  - Public repositories (no token needed, but rate-limited to 60 req/h)
 *  - Private repositories (requires `token`)
 *  - Specific branches, tags, or commits via `ref`
 *  - Recursive directory traversal with depth limit
 *  - Glob-style extension filtering (`includeExtensions`)
 *  - Path prefix filtering (`includePaths`)
 *
 * Rate limits:
 *  - Unauthenticated: 60 requests per hour per IP
 *  - Authenticated:   5,000 requests per hour per token
 *  For large repos, always provide a `token`.
 *
 * @example
 * ```typescript
 * // Load all Markdown files from a public repo
 * const loader = new GitHubLoader({
 *   owner: 'hazeljs',
 *   repo: 'hazeljs',
 *   ref: 'main',
 *   includeExtensions: ['.md'],
 *   token: process.env.GITHUB_TOKEN,
 * });
 * const docs = await loader.load();
 * // docs[0].metadata.path === 'README.md'
 * // docs[0].metadata.url  === 'https://github.com/hazeljs/hazeljs/blob/main/README.md'
 * ```
 *
 * Load a specific directory only:
 * ```typescript
 * const loader = new GitHubLoader({
 *   owner: 'facebook',
 *   repo: 'react',
 *   ref: 'main',
 *   directory: 'packages/react/src',
 *   includeExtensions: ['.js', '.ts'],
 * });
 * ```
 */

import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface GitHubLoaderOptions {
  /** GitHub organisation or user name. */
  owner: string;
  /** Repository name. */
  repo: string;
  /**
   * Branch, tag, or commit SHA.
   * @default 'main'
   */
  ref?: string;
  /**
   * Sub-directory inside the repository to load.
   * Defaults to the repository root (`''`).
   */
  directory?: string;
  /**
   * Only load files with these extensions.
   * @example ['.ts', '.md']
   */
  includeExtensions?: string[];
  /**
   * Only load files under these path prefixes (relative to `directory`).
   * @example ['src/', 'docs/']
   */
  includePaths?: string[];
  /**
   * Skip files under these path prefixes.
   * @example ['node_modules/', 'dist/', '__tests__/']
   */
  excludePaths?: string[];
  /**
   * Maximum number of files to load (safety limit).
   * @default 500
   */
  maxFiles?: number;
  /**
   * Maximum file size in bytes to load.
   * Files larger than this are skipped with a warning.
   * @default 102400 (100 KB)
   */
  maxFileSize?: number;
  /**
   * GitHub personal access token (PAT) or fine-grained token.
   * Required for private repos; recommended for public repos to avoid rate limits.
   */
  token?: string;
  /**
   * Request timeout in milliseconds.
   * @default 15000
   */
  timeout?: number;
  /** Extra metadata merged into every document. */
  metadata?: Record<string, unknown>;
}

interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
  url: string;
}

@Loader({
  name: 'GitHubLoader',
  description: 'Loads files from a GitHub repository using the GitHub REST API.',
})
export class GitHubLoader extends BaseDocumentLoader {
  private readonly opts: Required<GitHubLoaderOptions>;
  private readonly apiBase = 'https://api.github.com';

  constructor(options: GitHubLoaderOptions) {
    super();
    this.opts = {
      owner: options.owner,
      repo: options.repo,
      ref: options.ref ?? 'main',
      directory: options.directory ?? '',
      includeExtensions: options.includeExtensions ?? [],
      includePaths: options.includePaths ?? [],
      excludePaths: options.excludePaths ?? ['node_modules/', 'dist/', '.git/'],
      maxFiles: options.maxFiles ?? 500,
      maxFileSize: options.maxFileSize ?? 102_400,
      token: options.token ?? '',
      timeout: options.timeout ?? 15_000,
      metadata: options.metadata ?? {},
    };
  }

  async load(): Promise<Document[]> {
    const treeItems = await this.getTree();
    const filtered = this.filterItems(treeItems);

    if (filtered.length === 0) {
      console.warn(
        `[GitHubLoader] No files matched the filter criteria in ${this.opts.owner}/${this.opts.repo}`,
      );
      return [];
    }

    const docs: Document[] = [];

    for (let i = 0; i < filtered.length && docs.length < this.opts.maxFiles; i++) {
      const item = filtered[i];
      try {
        const content = await this.getFileContent(item);
        if (content !== null) {
          docs.push(
            this.createDocument(content, {
              source: item.path,
              path: item.path,
              repo: `${this.opts.owner}/${this.opts.repo}`,
              ref: this.opts.ref,
              url: `https://github.com/${this.opts.owner}/${this.opts.repo}/blob/${this.opts.ref}/${item.path}`,
              rawUrl: `https://raw.githubusercontent.com/${this.opts.owner}/${this.opts.repo}/${this.opts.ref}/${item.path}`,
              sha: item.sha,
              loaderType: 'github',
              ...this.opts.metadata,
            }),
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[GitHubLoader] Skipping ${item.path}: ${message}`);
      }
    }

    return docs;
  }

  // ── Private: GitHub API helpers ──────────────────────────────────────────

  private async getTree(): Promise<GitHubTreeItem[]> {
    // Use the recursive git tree endpoint — one API call for the whole repo
    const url =
      `${this.apiBase}/repos/${this.opts.owner}/${this.opts.repo}` +
      `/git/trees/${this.opts.ref}?recursive=1`;

    const data = await this.apiGet<{
      tree: GitHubTreeItem[];
      truncated: boolean;
    }>(url);

    if (data.truncated) {
      console.warn(
        `[GitHubLoader] Repository tree was truncated by the GitHub API ` +
        `(too many files). Use \`directory\` or \`includePaths\` to narrow the scope.`,
      );
    }

    let items = data.tree.filter((item) => item.type === 'blob');

    // Restrict to `directory` prefix if set
    if (this.opts.directory) {
      const prefix = this.opts.directory.replace(/\/$/, '') + '/';
      items = items.filter((item) => item.path.startsWith(prefix));
    }

    return items;
  }

  private filterItems(items: GitHubTreeItem[]): GitHubTreeItem[] {
    return items.filter((item) => {
      const path = item.path;
      const ext = '.' + path.split('.').pop()!.toLowerCase();

      // Extension filter
      if (
        this.opts.includeExtensions.length > 0 &&
        !this.opts.includeExtensions.includes(ext)
      ) {
        return false;
      }

      // Include path filter
      if (
        this.opts.includePaths.length > 0 &&
        !this.opts.includePaths.some((prefix) => path.startsWith(prefix))
      ) {
        return false;
      }

      // Exclude path filter
      if (this.opts.excludePaths.some((prefix) => path.startsWith(prefix))) {
        return false;
      }

      // File size filter
      if (item.size !== undefined && item.size > this.opts.maxFileSize) {
        console.warn(
          `[GitHubLoader] Skipping ${path} — size ${item.size} bytes exceeds maxFileSize ${this.opts.maxFileSize}`,
        );
        return false;
      }

      return true;
    });
  }

  private async getFileContent(item: GitHubTreeItem): Promise<string | null> {
    // Use raw content URL to avoid base64 decoding and extra API calls
    const rawUrl =
      `https://raw.githubusercontent.com/${this.opts.owner}/${this.opts.repo}` +
      `/${this.opts.ref}/${item.path}`;

    const response = await this.httpGet(rawUrl);

    // Skip binary files
    if (this.isBinary(response)) {
      return null;
    }

    return response;
  }

  private async apiGet<T>(url: string): Promise<T> {
    const text = await this.httpGet(url);
    return JSON.parse(text) as T;
  }

  private async httpGet(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeout);

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'HazelJS-RAG/1.0',
    };
    if (this.opts.token) {
      headers['Authorization'] = `Bearer ${this.opts.token}`;
    }

    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const hint = response.status === 403
        ? ' (rate limited — provide a GitHub token with the `token` option)'
        : response.status === 404
        ? ' (repo or path not found — check owner/repo/ref/directory)'
        : '';
      throw new Error(
        `GitHub API error ${response.status}${hint}: ${body.slice(0, 200)}`,
      );
    }

    return response.text();
  }

  private isBinary(text: string): boolean {
    // Heuristic: if > 10% of the first 512 bytes are non-text codepoints, treat as binary
    const sample = text.slice(0, 512);
    let nonText = 0;
    for (let i = 0; i < sample.length; i++) {
      const code = sample.charCodeAt(i);
      if (code < 9 || (code > 13 && code < 32 && code !== 27)) {
        nonText++;
      }
    }
    return nonText / sample.length > 0.1;
  }
}
