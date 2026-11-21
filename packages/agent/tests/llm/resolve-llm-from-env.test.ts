import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveLlmFromEnv } from '../../src/llm/resolve-llm-from-env';
import { loadProjectEnv } from '../../src/node/load-project-env';
import type { LLMProvider } from '../../src/types/llm.types';

describe('loadProjectEnv', () => {
  let tmp: string;
  const prevKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-agent-env-'));
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  it('loads .env via @hazeljs/config when available', () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'OPENAI_API_KEY=sk-from-config\n');
    const loaded = loadProjectEnv(tmp);
    // Soft peer: when @hazeljs/config is installed (devDep), file is loaded.
    if (loaded.length > 0) {
      expect(process.env.OPENAI_API_KEY).toBe('sk-from-config');
    } else {
      expect(loaded).toEqual([]);
    }
  });
});

describe('resolveLlmFromEnv', () => {
  it('returns explicit provider when provided', () => {
    const explicit: LLMProvider = {
      chat: async () => ({ content: 'explicit' }),
    };
    expect(resolveLlmFromEnv({ llmProvider: explicit, env: {} })).toBe(explicit);
  });

  it('returns mock when no API key', async () => {
    const llm = resolveLlmFromEnv({ env: {} });
    const res = await llm.chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.content).toMatch(/OPENAI_API_KEY/);
  });

  it('returns HTTP provider when OPENAI_API_KEY is set', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok', tool_calls: [] }, finish_reason: 'stop' }],
        }),
      } as Response;
    }) as typeof fetch;

    const prevFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
      // createHttpLlmProvider captures fetch at construction time
      const llm = resolveLlmFromEnv({
        env: {
          OPENAI_API_KEY: 'sk-test',
          HAZEL_AGENT_MODEL: 'gpt-test',
          OPENAI_BASE_URL: 'https://example.test/v1',
        },
      });
      const res = await llm.chat({
        messages: [{ role: 'user', content: 'hi' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'ping',
              description: 'ping',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
      });
      expect(res.content).toBe('ok');
      expect(calls[0].url).toBe('https://example.test/v1/chat/completions');
      expect((calls[0].body as { model: string }).model).toBe('gpt-test');
      expect((calls[0].body as { tool_choice: string }).tool_choice).toBe('auto');
    } finally {
      globalThis.fetch = prevFetch;
    }
  });
});
