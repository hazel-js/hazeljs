import 'reflect-metadata';
import {
  Loader,
  getLoaderConfig,
  BaseDocumentLoader,
  DocumentLoaderRegistry,
} from '../../loaders/base.loader';
import type { Document } from '../../types';

// Concrete loader for testing BaseDocumentLoader
class TestLoader extends BaseDocumentLoader {
  async load(): Promise<Document[]> {
    return [this.createDocument('test content', { source: 'test.txt' })];
  }

  exposeCreateDocuments(pages: string[], meta?: Record<string, unknown>): Document[] {
    return this.createDocuments(pages, meta);
  }
}

@Loader({
  name: 'DecoratedLoader',
  description: 'A test loader',
  extensions: ['.test'],
  mimeTypes: ['application/test'],
})
class DecoratedLoader extends BaseDocumentLoader {
  async load(): Promise<Document[]> {
    return [];
  }
}

class UndecoatedLoader extends BaseDocumentLoader {
  async load(): Promise<Document[]> {
    return [];
  }
}

describe('@Loader decorator & getLoaderConfig', () => {
  it('stores config on a decorated class', () => {
    const config = getLoaderConfig(DecoratedLoader);
    expect(config).toEqual({
      name: 'DecoratedLoader',
      description: 'A test loader',
      extensions: ['.test'],
      mimeTypes: ['application/test'],
    });
  });

  it('returns undefined for an undecorated class', () => {
    expect(getLoaderConfig(UndecoatedLoader)).toBeUndefined();
  });
});

describe('BaseDocumentLoader', () => {
  let loader: TestLoader;

  beforeEach(() => {
    loader = new TestLoader();
  });

  it('createDocument trims content and sets metadata', async () => {
    const docs = await loader.load();
    expect(docs[0].content).toBe('test content');
    expect(docs[0].metadata?.source).toBe('test.txt');
  });

  it('createDocuments returns one doc per non-empty page', () => {
    const docs = loader.exposeCreateDocuments(['page 1', '  ', 'page 3'], { source: 'multi.pdf' });
    expect(docs).toHaveLength(2);
    expect(docs[0].content).toBe('page 1');
    expect(docs[0].metadata?.pageNumber).toBe(1);
    expect(docs[0].metadata?.totalPages).toBe(3);
    expect(docs[1].metadata?.pageNumber).toBe(3);
  });

  it('createDocuments filters out blank pages', () => {
    const docs = loader.exposeCreateDocuments(['', '   ', '\t']);
    expect(docs).toHaveLength(0);
  });
});

describe('DocumentLoaderRegistry', () => {
  beforeEach(() => {
    // Clear registry state between tests by re-registering
  });

  it('registers a loader and retrieves by extension', () => {
    DocumentLoaderRegistry.register(DecoratedLoader, () => new DecoratedLoader());
    const loader = DocumentLoaderRegistry.forExtension('.test');
    expect(loader).toBeInstanceOf(DecoratedLoader);
  });

  it('retrieves by MIME type', () => {
    DocumentLoaderRegistry.register(DecoratedLoader, () => new DecoratedLoader());
    const loader = DocumentLoaderRegistry.forMimeType('application/test');
    expect(loader).toBeInstanceOf(DecoratedLoader);
  });

  it('returns undefined for unregistered extension', () => {
    expect(DocumentLoaderRegistry.forExtension('.xyz123')).toBeUndefined();
  });

  it('returns undefined for unregistered MIME type', () => {
    expect(DocumentLoaderRegistry.forMimeType('application/xyz123')).toBeUndefined();
  });

  it('is case-insensitive for extensions', () => {
    DocumentLoaderRegistry.register(DecoratedLoader, () => new DecoratedLoader());
    const lower = DocumentLoaderRegistry.forExtension('.test');
    const upper = DocumentLoaderRegistry.forExtension('.TEST');
    expect(lower).toBeDefined();
    expect(upper).toBeDefined();
  });

  it('lists registered extensions', () => {
    DocumentLoaderRegistry.register(DecoratedLoader, () => new DecoratedLoader());
    const exts = DocumentLoaderRegistry.registeredExtensions();
    expect(exts).toContain('.test');
  });

  it('does nothing when class has no @Loader decorator', () => {
    const before = DocumentLoaderRegistry.registeredExtensions().length;
    DocumentLoaderRegistry.register(UndecoatedLoader, () => new UndecoatedLoader());
    const after = DocumentLoaderRegistry.registeredExtensions().length;
    expect(after).toBe(before);
  });
});
