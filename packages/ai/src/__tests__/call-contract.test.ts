import { z } from 'zod';
import { AIModule } from '../ai.module';
import { AIEnhancedService } from '../ai-enhanced.service';
import { FakeModel } from '../testing/fake-model';
import { AIError, AIErrorCode } from '../errors/ai.error';
import { AgentTool } from '../tools/agent-tool.decorator';
import { InMemoryApprovalPort } from '../approval/approval-port';
import { EventEmitter } from 'events';
import { pipeTextStreamToResponse } from '../stream/ui-stream';
import type { ServerResponse } from 'http';

function resetModule(): void {
  AIModule.register({});
}

describe('AI call contract', () => {
  afterEach(() => {
    resetModule();
  });

  it('fails before complete when a named model is missing', async () => {
    AIModule.register({
      models: {
        default: { provider: 'openai', model: 'gpt-4o' },
      },
    });
    const fake = new FakeModel(['ok']);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);

    await expect(
      ai.complete({ messages: [{ role: 'user', content: 'hi' }] }, { modelName: 'missing' })
    ).rejects.toMatchObject({ code: AIErrorCode.MODEL_NOT_CONFIGURED });
    expect(fake.calls).toHaveLength(0);
  });

  it('retries 429 once then succeeds', async () => {
    AIModule.register({
      models: {
        default: {
          provider: 'openai',
          model: 'gpt-4o',
          retry: { attempts: 3, backoff: { delayMs: 1, jitter: false } },
        },
      },
      defaults: { timeoutMs: 5_000 },
    });
    const fake = new FakeModel([
      { error: { statusCode: 429, message: 'rate limited', retryable: true } },
      'hello after retry',
    ]);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);

    const res = await ai.complete(
      { messages: [{ role: 'user', content: 'hi' }] },
      { modelName: 'default' }
    );
    expect(res.content).toBe('hello after retry');
    expect(fake.calls).toHaveLength(2);
  });

  it('does not retry 400 and does not fall back when fallbackIf excludes it', async () => {
    AIModule.register({
      models: {
        default: {
          provider: 'openai',
          model: 'gpt-4o',
          fallback: 'backup',
          retry: { attempts: 3, backoff: { delayMs: 1, jitter: false } },
        },
        backup: { provider: 'openai', model: 'gpt-4o-mini' },
      },
    });
    const fake = new FakeModel([
      { error: { statusCode: 400, message: 'bad request', retryable: false } },
      'should not reach',
    ]);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);

    await expect(
      ai.complete(
        { messages: [{ role: 'user', content: 'hi' }] },
        {
          modelName: 'default',
          fallbackIf: (err) => {
            const status = (err as { statusCode?: number }).statusCode;
            return status !== 400;
          },
        }
      )
    ).rejects.toBeTruthy();
    expect(fake.calls).toHaveLength(1);
  });

  it('throws OUTPUT_INVALID after one provider call on schema mismatch', async () => {
    AIModule.register({
      models: {
        default: { provider: 'openai', model: 'gpt-4o' },
      },
    });
    const fake = new FakeModel(['not-json-at-all']);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);

    await expect(
      ai.generateObject('return an object', z.object({ a: z.string() }), {
        modelName: 'default',
      })
    ).rejects.toMatchObject({ code: AIErrorCode.OUTPUT_INVALID });
    expect(fake.calls).toHaveLength(1);
  });

  it('stops the next tool step when budget is exceeded', async () => {
    AIModule.register({
      models: {
        default: {
          provider: 'openai',
          model: 'gpt-4o',
          pricing: { input: 1, output: 1 },
        },
      },
      defaults: { maxSteps: 5 },
    });

    class Tools {
      @AgentTool({
        name: 'ping',
        description: 'ping',
        inputSchema: z.object({ n: z.number() }),
      })
      async ping(input: { n: number }) {
        return { n: input.n };
      }
    }

    const fake = new FakeModel([
      {
        toolCalls: [{ name: 'ping', input: { n: 1 } }],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      },
      {
        toolCalls: [{ name: 'ping', input: { n: 2 } }],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      },
      'done',
    ]);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);
    ai.registerTools(new Tools());

    await expect(
      ai.complete(
        { messages: [{ role: 'user', content: 'go' }] },
        { modelName: 'default', tools: ['ping'], budget: { maxTokens: 100 } }
      )
    ).rejects.toMatchObject({ code: AIErrorCode.BUDGET_EXCEEDED });
  });

  it('does not run an approve tool until the port approves, and rejection reaches the next step', async () => {
    AIModule.register({
      models: {
        default: { provider: 'openai', model: 'gpt-4o' },
      },
      defaults: { maxSteps: 5 },
    });

    const refundCalls: unknown[] = [];
    class Tools {
      @AgentTool({
        name: 'refund',
        description: 'refund an order',
        inputSchema: z.object({ orderId: z.string() }),
      })
      async refund(input: { orderId: string }) {
        refundCalls.push(input);
        return { refunded: input.orderId };
      }
    }

    const port = new InMemoryApprovalPort();
    port.setDecision('call_0:refund', { rejected: 'manager said no' });

    const fake = new FakeModel([
      { toolCalls: [{ name: 'refund', input: { orderId: 'ord_1' }, id: 'call_0' }] },
      'Understood, refund was rejected.',
    ]);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);
    ai.registerTools(new Tools());
    ai.setApprovalPort(port);

    const res = await ai.complete(
      { messages: [{ role: 'user', content: 'refund please' }] },
      { modelName: 'default', tools: ['refund'], approve: ['refund'] }
    );

    expect(refundCalls).toHaveLength(0);
    expect(res.content).toContain('rejected');
    expect(fake.calls.length).toBeGreaterThanOrEqual(2);
    const second = fake.calls[1];
    const toolMsg = second.messages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('manager said no');
  });

  it('aborts a text stream when the response closes', async () => {
    const fake = new FakeModel([
      {
        text: 'one two three four five six seven eight nine ten',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      },
    ]);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);

    const res = new EventEmitter() as EventEmitter &
      ServerResponse & {
        headersSent: boolean;
        writableEnded: boolean;
        writeHead: jest.Mock;
        write: jest.Mock;
        end: jest.Mock;
      };
    res.headersSent = false;
    res.writableEnded = false;
    res.writeHead = jest.fn();
    res.write = jest.fn();
    res.end = jest.fn(() => {
      res.writableEnded = true;
      return res;
    }) as unknown as typeof res.end;

    const stream = ai.streamComplete({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'gpt-4o',
    });

    const pipePromise = pipeTextStreamToResponse(res as unknown as ServerResponse, stream);
    // Simulate client disconnect shortly after start
    setImmediate(() => res.emit('close'));
    await pipePromise;
    expect(res.end).toHaveBeenCalled();
  });

  it('validateModels fails at register when fallback name is unknown', () => {
    expect(() =>
      AIModule.register({
        models: {
          default: { provider: 'openai', model: 'gpt-4o', fallback: 'nope' },
        },
      })
    ).toThrow(AIError);
  });
});
