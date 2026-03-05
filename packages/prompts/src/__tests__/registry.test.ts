import { PromptRegistry } from '../registry';
import { PromptTemplate } from '../template';
import { MemoryStore } from '../stores/memory.store';

function makeTpl(name: string, body = 'Hello {name}', version = '1.0.0') {
  return new PromptTemplate<{ name: string }>(body, { name, version });
}

beforeEach(() => {
  PromptRegistry.clear();
  PromptRegistry.configure([]);
});

afterAll(() => {
  PromptRegistry.clear();
  PromptRegistry.configure([]);
});

// ── Sync API ──────────────────────────────────────────────────────────────────

describe('register()', () => {
  it('registers a new prompt', () => {
    PromptRegistry.register('test:key', makeTpl('T'));
    expect(PromptRegistry.has('test:key')).toBe(true);
  });

  it('does NOT overwrite an existing registration', () => {
    PromptRegistry.register('test:key', makeTpl('First', 'First template'));
    PromptRegistry.register('test:key', makeTpl('Second', 'Second template'));
    expect(PromptRegistry.get('test:key').template).toBe('First template');
  });
});

describe('override()', () => {
  it('registers a new prompt', () => {
    PromptRegistry.override('test:override', makeTpl('OV'));
    expect(PromptRegistry.has('test:override')).toBe(true);
  });

  it('overwrites an existing registration', () => {
    PromptRegistry.register('test:key', makeTpl('First', 'First template'));
    PromptRegistry.override('test:key', makeTpl('Second', 'Second template'));
    expect(PromptRegistry.get('test:key').template).toBe('Second template');
  });
});

describe('get()', () => {
  it('returns a registered prompt', () => {
    const tpl = makeTpl('Getter');
    PromptRegistry.register('get:test', tpl);
    expect(PromptRegistry.get('get:test')).toBe(tpl);
  });

  it('throws a descriptive error for unknown key', () => {
    expect(() => PromptRegistry.get('nonexistent:key')).toThrow(
      '[PromptRegistry] Prompt not found: "nonexistent:key"'
    );
  });

  it('error message lists registered keys', () => {
    PromptRegistry.register('existing:key', makeTpl('EX'));
    expect(() => PromptRegistry.get('unknown')).toThrow('existing:key');
  });
});

describe('get() with version', () => {
  it('returns a specific cached version', () => {
    const v1 = new PromptTemplate('v1 template', { name: 'T', version: '1.0.0' });
    const v2 = new PromptTemplate('v2 template', { name: 'T', version: '2.0.0' });
    PromptRegistry.register('versioned:key', v1);
    PromptRegistry.override('versioned:key', v2);
    expect(PromptRegistry.get('versioned:key', '1.0.0').template).toBe('v1 template');
    expect(PromptRegistry.get('versioned:key', '2.0.0').template).toBe('v2 template');
  });

  it('throws for an unknown version', () => {
    PromptRegistry.register('versioned:key', makeTpl('T', 'body', '1.0.0'));
    expect(() => PromptRegistry.get('versioned:key', '9.9.9')).toThrow('9.9.9');
  });
});

describe('has()', () => {
  it('returns true for registered key', () => {
    PromptRegistry.register('has:test', makeTpl('H'));
    expect(PromptRegistry.has('has:test')).toBe(true);
  });

  it('returns false for unregistered key', () => {
    expect(PromptRegistry.has('missing:key')).toBe(false);
  });

  it('checks a specific version', () => {
    PromptRegistry.register('has:v', makeTpl('HV', 'body', '1.0.0'));
    expect(PromptRegistry.has('has:v', '1.0.0')).toBe(true);
    expect(PromptRegistry.has('has:v', '2.0.0')).toBe(false);
  });
});

describe('list()', () => {
  it('returns empty array when nothing is registered', () => {
    expect(PromptRegistry.list()).toEqual([]);
  });

  it('returns all registered keys in insertion order', () => {
    PromptRegistry.register('a', makeTpl('A'));
    PromptRegistry.register('b', makeTpl('B'));
    PromptRegistry.register('c', makeTpl('C'));
    expect(PromptRegistry.list()).toEqual(['a', 'b', 'c']);
  });
});

describe('versions()', () => {
  it('returns empty array for unregistered key', () => {
    expect(PromptRegistry.versions('unknown')).toEqual([]);
  });

  it('returns cached versions for a key', () => {
    PromptRegistry.register('v:key', makeTpl('T', 'body', '1.0.0'));
    PromptRegistry.override('v:key', makeTpl('T', 'body', '2.0.0'));
    const vers = PromptRegistry.versions('v:key');
    expect(vers).toContain('1.0.0');
    expect(vers).toContain('2.0.0');
  });
});

describe('unregister()', () => {
  it('removes a registered key', () => {
    PromptRegistry.register('remove:me', makeTpl('RM'));
    PromptRegistry.unregister('remove:me');
    expect(PromptRegistry.has('remove:me')).toBe(false);
  });

  it('removes only a specific version when version supplied', () => {
    PromptRegistry.register('remove:v', makeTpl('RV', 'body', '1.0.0'));
    PromptRegistry.override('remove:v', makeTpl('RV', 'body', '2.0.0'));
    PromptRegistry.unregister('remove:v', '1.0.0');
    expect(PromptRegistry.has('remove:v', '1.0.0')).toBe(false);
    expect(PromptRegistry.has('remove:v', '2.0.0')).toBe(true);
  });

  it('is a no-op for non-existent key', () => {
    expect(() => PromptRegistry.unregister('does:not:exist')).not.toThrow();
  });
});

describe('clear()', () => {
  it('removes all registered prompts', () => {
    PromptRegistry.register('a', makeTpl('A'));
    PromptRegistry.register('b', makeTpl('B'));
    PromptRegistry.clear();
    expect(PromptRegistry.list()).toEqual([]);
  });
});

// ── Store API ─────────────────────────────────────────────────────────────────

describe('configure() / addStore() / storeNames()', () => {
  it('configure() sets stores', () => {
    const store = new MemoryStore();
    PromptRegistry.configure([store]);
    expect(PromptRegistry.storeNames()).toContain('memory');
  });

  it('addStore() appends a store', () => {
    PromptRegistry.configure([new MemoryStore()]);
    PromptRegistry.addStore(new MemoryStore());
    expect(PromptRegistry.storeNames()).toHaveLength(2);
  });
});

describe('save() / saveAll()', () => {
  it('save() persists to configured stores', async () => {
    const store = new MemoryStore();
    PromptRegistry.configure([store]);
    PromptRegistry.register('save:test', makeTpl('ST', 'body', '1.0.0'));
    await PromptRegistry.save('save:test');
    expect(await store.has('save:test')).toBe(true);
  });

  it('saveAll() persists all prompts', async () => {
    const store = new MemoryStore();
    PromptRegistry.configure([store]);
    PromptRegistry.register('sa:1', makeTpl('SA1'));
    PromptRegistry.register('sa:2', makeTpl('SA2'));
    await PromptRegistry.saveAll();
    expect(await store.has('sa:1')).toBe(true);
    expect(await store.has('sa:2')).toBe(true);
  });
});

describe('loadAll()', () => {
  it('loads prompts from the primary store into cache', async () => {
    const store = new MemoryStore();
    PromptRegistry.configure([store]);
    const tpl = makeTpl('Loaded', 'loaded body', '1.0.0');
    await store.set({
      key: 'load:test',
      version: '1.0.0',
      template: tpl.template,
      metadata: tpl.metadata,
      storedAt: new Date().toISOString(),
    });
    await PromptRegistry.loadAll();
    expect(PromptRegistry.has('load:test')).toBe(true);
    expect(PromptRegistry.get('load:test').template).toBe('loaded body');
  });

  it('loadAll(true) overwrites existing cache entries', async () => {
    const store = new MemoryStore();
    PromptRegistry.configure([store]);
    PromptRegistry.register('overwrite:test', makeTpl('Old', 'old body'));
    await store.set({
      key: 'overwrite:test',
      version: '2.0.0',
      template: 'new body',
      metadata: { name: 'New', version: '2.0.0' },
      storedAt: new Date().toISOString(),
    });
    await PromptRegistry.loadAll(true);
    expect(PromptRegistry.get('overwrite:test').template).toBe('new body');
  });

  it('loadAll() is a no-op when no stores configured', async () => {
    PromptRegistry.register('noop:test', makeTpl('NOOP'));
    await expect(PromptRegistry.loadAll()).resolves.not.toThrow();
    expect(PromptRegistry.has('noop:test')).toBe(true);
  });
});

describe('load()', () => {
  it('loads a single prompt from store into cache', async () => {
    const store = new MemoryStore();
    PromptRegistry.configure([store]);
    await store.set({
      key: 'load:single',
      version: 'latest',
      template: 'single body',
      metadata: { name: 'S' },
      storedAt: new Date().toISOString(),
    });
    const tpl = await PromptRegistry.load('load:single');
    expect(tpl?.template).toBe('single body');
    expect(PromptRegistry.has('load:single')).toBe(true);
  });

  it('returns null when not found in any store', async () => {
    PromptRegistry.configure([new MemoryStore()]);
    const result = await PromptRegistry.load('totally:missing');
    expect(result).toBeNull();
  });
});

describe('getAsync()', () => {
  it('returns cached prompt without hitting stores', async () => {
    const tpl = makeTpl('Cached');
    PromptRegistry.register('cached:key', tpl);
    const result = await PromptRegistry.getAsync('cached:key');
    expect(result).toBe(tpl);
  });

  it('falls back to store when not in cache', async () => {
    const store = new MemoryStore();
    PromptRegistry.configure([store]);
    await store.set({
      key: 'async:key',
      version: 'latest',
      template: 'async body',
      metadata: { name: 'Async' },
      storedAt: new Date().toISOString(),
    });
    const result = await PromptRegistry.getAsync('async:key');
    expect(result.template).toBe('async body');
  });

  it('throws when not found anywhere', async () => {
    PromptRegistry.configure([new MemoryStore()]);
    await expect(PromptRegistry.getAsync('totally:missing')).rejects.toThrow(
      '[PromptRegistry] Prompt "totally:missing"'
    );
  });
});

// ── End-to-end ────────────────────────────────────────────────────────────────

describe('end-to-end render via registry', () => {
  it('retrieves and renders correctly', () => {
    const tpl = new PromptTemplate<{ query: string; context: string }>(
      'Context: {context}\nQ: {query}',
      { name: 'E2E', version: '1.0.0' }
    );
    PromptRegistry.register('e2e:test', tpl);
    const rendered = PromptRegistry.get<{ query: string; context: string }>('e2e:test').render({
      query: 'What is TypeScript?',
      context: 'TypeScript is a typed superset of JavaScript.',
    });
    expect(rendered).toBe(
      'Context: TypeScript is a typed superset of JavaScript.\nQ: What is TypeScript?'
    );
  });
});
