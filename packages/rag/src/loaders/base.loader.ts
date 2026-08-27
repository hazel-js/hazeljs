/**
 * Base Document Loader
 *
 * Abstract base class for all document loaders in @hazeljs/rag.
 * Every loader:
 *  1. Extends `BaseDocumentLoader`
 *  2. Implements `load(): Promise<Document[]>`
 *  3. May optionally be decorated with `@Loader` for metadata reflection
 *
 * The `@Loader` decorator stores descriptive metadata on the class so that
 * a DocumentLoaderRegistry or DI container can enumerate available loaders,
 * display them in a developer UI, and auto-select the right one by MIME type
 * or file extension.
 *
 * @example
 * ```typescript
 * @Loader({
 *   name: 'MyCustomLoader',
 *   description: 'Loads .xyz files from a proprietary database',
 *   extensions: ['.xyz'],
 * })
 * export class MyCustomLoader extends BaseDocumentLoader {
 *   async load(): Promise<Document[]> {
 *     return [this.createDocument('content', { source: 'custom' })];
 *   }
 * }
 * ```
 */

import 'reflect-metadata';
import type { Document, DocumentLoader } from '../types';

// ── Metadata keys ────────────────────────────────────────────────────────────

const LOADER_METADATA_KEY = Symbol('hazel:rag:loader');

// ── @Loader decorator ────────────────────────────────────────────────────────

export interface LoaderConfig {
  /** Human-readable name used in logs and the registry. */
  name: string;
  /** Short description of what this loader handles. */
  description?: string;
  /**
   * File extensions this loader handles (with leading dot).
   * @example ['.pdf', '.PDF']
   */
  extensions?: string[];
  /**
   * MIME types this loader handles.
   * @example ['application/pdf']
   */
  mimeTypes?: string[];
}

/**
 * Mark a class as a document loader.
 *
 * Stores `LoaderConfig` metadata on the class that can be read at runtime
 * via `getLoaderConfig()`.  Applying `@Loader` is optional — any class that
 * extends `BaseDocumentLoader` works without it.
 */
export function Loader(config: LoaderConfig): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(LOADER_METADATA_KEY, config, target);
  };
}

/**
 * Read the `@Loader` config from a class.
 * Returns `undefined` if the decorator was not applied.
 */
export function getLoaderConfig(target: object): LoaderConfig | undefined {
  return Reflect.getMetadata(LOADER_METADATA_KEY, target);
}

// ── Base class ───────────────────────────────────────────────────────────────

/**
 * Abstract base class for all document loaders.
 *
 * Provides convenience helpers for creating well-formed `Document` objects
 * and normalising metadata.  All loaders must implement `load()`.
 */
export abstract class BaseDocumentLoader implements DocumentLoader {
  /** Load documents from the source. */
  abstract load(): Promise<Document[]>;

  /**
   * Convenience factory for creating a `Document` with normalised whitespace.
   *
   * @param content  The raw text content.
   * @param metadata Optional metadata attached to the document.
   */
  protected createDocument(content: string, metadata?: Record<string, unknown>): Document {
    return {
      content: content.trim(),
      metadata: metadata ?? {},
    };
  }

  /**
   * Split a large string into multiple `Document` objects, one per page or
   * logical section.  Useful for loaders that produce multi-page content
   * (PDF, DOCX) where you want one document per page.
   */
  protected createDocuments(pages: string[], baseMetadata?: Record<string, unknown>): Document[] {
    return pages
      .map((page, idx) =>
        this.createDocument(page, {
          ...baseMetadata,
          pageNumber: idx + 1,
          totalPages: pages.length,
        })
      )
      .filter((doc) => doc.content.length > 0);
  }
}

// ── DocumentLoaderRegistry ───────────────────────────────────────────────────

/**
 * Simple in-process registry that maps file extensions and MIME types to
 * loader factories.  Loaders self-register by calling `registerLoader()`.
 *
 * @example
 * ```typescript
 * DocumentLoaderRegistry.register(PdfLoader, () => new PdfLoader({ path: '...' }));
 * const loader = DocumentLoaderRegistry.forExtension('.pdf', { path: 'doc.pdf' });
 * const docs = await loader.load();
 * ```
 */
type LoaderFactory<T extends BaseDocumentLoader> = (opts: unknown) => T;

export class DocumentLoaderRegistry {
  private static byExtension = new Map<string, LoaderFactory<BaseDocumentLoader>>();
  private static byMimeType = new Map<string, LoaderFactory<BaseDocumentLoader>>();

  /** Register a loader class and factory for all its declared extensions / MIME types. */
  static register<T extends BaseDocumentLoader>(
    loaderClass: new (...args: unknown[]) => T,
    factory: LoaderFactory<T>
  ): void {
    const config = getLoaderConfig(loaderClass);
    if (!config) return;

    for (const ext of config.extensions ?? []) {
      DocumentLoaderRegistry.byExtension.set(
        ext.toLowerCase(),
        factory as LoaderFactory<BaseDocumentLoader>
      );
    }
    for (const mime of config.mimeTypes ?? []) {
      DocumentLoaderRegistry.byMimeType.set(
        mime.toLowerCase(),
        factory as LoaderFactory<BaseDocumentLoader>
      );
    }
  }

  /** Get a loader factory by file extension (e.g. `".pdf"`). */
  static forExtension(ext: string, opts?: unknown): BaseDocumentLoader | undefined {
    const factory = DocumentLoaderRegistry.byExtension.get(ext.toLowerCase());
    return factory ? factory(opts) : undefined;
  }

  /** Get a loader factory by MIME type (e.g. `"application/pdf"`). */
  static forMimeType(mimeType: string, opts?: unknown): BaseDocumentLoader | undefined {
    const factory = DocumentLoaderRegistry.byMimeType.get(mimeType.toLowerCase());
    return factory ? factory(opts) : undefined;
  }

  /** List all registered extensions. */
  static registeredExtensions(): string[] {
    return [...DocumentLoaderRegistry.byExtension.keys()];
  }
}
