import { readFile } from 'fs/promises';
import type { ContextLoadInput, ContextSourceDefinition, LoadedSourceChunk } from '../types';
import { CagError } from '../errors/cag.error';
import { estimateTokens } from '../budget/token-budget';

/**
 * Loads registered context sources into text chunks.
 * File / URL loading prefers @hazeljs/rag loaders when available; otherwise
 * falls back to fs / fetch.
 */
export class ContextLoader {
  constructor(private readonly tokenCounter: (text: string) => number = estimateTokens) {}

  async loadAll(
    sources: ContextSourceDefinition[],
    input: ContextLoadInput
  ): Promise<LoadedSourceChunk[]> {
    const chunks: LoadedSourceChunk[] = [];
    for (const source of sources) {
      try {
        const content = await this.loadOne(source, input);
        if (!content) continue;
        const priority = source.priority ?? 50;
        chunks.push({
          id: source.id,
          content,
          priority,
          compressible: source.compressible !== false && priority < 90,
          version: source.version,
          tokenEstimate: this.tokenCounter(content),
        });
      } catch (err) {
        throw CagError.sourceLoadFailed(
          source.id,
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }
    return chunks;
  }

  private async loadOne(def: ContextSourceDefinition, input: ContextLoadInput): Promise<string> {
    const src = def.source;
    switch (src.type) {
      case 'text':
        return src.content;
      case 'json':
        return typeof src.data === 'string' ? src.data : JSON.stringify(src.data, null, 2);
      case 'function':
      case 'custom':
      case 'memory':
        return String(await src.load(input));
      case 'rag':
        return String(await src.retrieve(input));
      case 'file':
        return this.loadFile(src.path);
      case 'url':
        return this.loadUrl(src.url);
      default:
        return '';
    }
  }

  private async loadFile(path: string): Promise<string> {
    try {
      // Prefer RAG loaders when installed
      const rag = await tryImportRag();
      if (rag) {
        const ext = path.split('.').pop()?.toLowerCase() ?? '';
        if (ext === 'md' || ext === 'markdown') {
          const loader = new rag.MarkdownFileLoader(path);
          const docs = await loader.load();
          return docs
            .map(
              (d: { pageContent?: string; content?: string }) => d.pageContent ?? d.content ?? ''
            )
            .join('\n\n');
        }
        if (ext === 'json') {
          const loader = new rag.JSONFileLoader(path);
          const docs = await loader.load();
          return docs
            .map(
              (d: { pageContent?: string; content?: string }) => d.pageContent ?? d.content ?? ''
            )
            .join('\n\n');
        }
        if (ext === 'txt' || ext === 'text') {
          const loader = new rag.TextFileLoader(path);
          const docs = await loader.load();
          return docs
            .map(
              (d: { pageContent?: string; content?: string }) => d.pageContent ?? d.content ?? ''
            )
            .join('\n\n');
        }
      }
    } catch {
      // fall through to fs
    }
    return readFile(path, 'utf8');
  }

  private async loadUrl(url: string): Promise<string> {
    try {
      const rag = await tryImportRag();
      if (rag?.WebLoader) {
        const loader = new rag.WebLoader(url);
        const docs = await loader.load();
        return docs
          .map((d: { pageContent?: string; content?: string }) => d.pageContent ?? d.content ?? '')
          .join('\n\n');
      }
    } catch {
      // fall through
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    return res.text();
  }
}

async function tryImportRag(): Promise<{
  MarkdownFileLoader: new (path: string) => {
    load(): Promise<Array<{ pageContent?: string; content?: string }>>;
  };
  JSONFileLoader: new (path: string) => {
    load(): Promise<Array<{ pageContent?: string; content?: string }>>;
  };
  TextFileLoader: new (path: string) => {
    load(): Promise<Array<{ pageContent?: string; content?: string }>>;
  };
  WebLoader?: new (url: string) => {
    load(): Promise<Array<{ pageContent?: string; content?: string }>>;
  };
} | null> {
  try {
    // Dynamic optional peer
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@hazeljs/rag');
  } catch {
    return null;
  }
}
